import { v } from "convex/values";
import { authedOrgQuery, authedOrgMutation } from "./lib/orgFunctions";
import {
  getOrgDocOrThrow,
  requireOrgPermission,
  PERMISSIONS,
} from "./lib/auth";
import { assertWithinClientLimit } from "./lib/billing";
import type { Doc } from "./_generated/dataModel";

// Statuses that count toward an outstanding balance (i.e. owed but not paid).
const OUTSTANDING_STATUSES = new Set(["sent", "viewed", "overdue"]);

export const list = authedOrgQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      outstandingBalance: v.number(),
      invoiceCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    requireOrgPermission(ctx, PERMISSIONS.clientsRead);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org_and_name", (q) => q.eq("orgId", ctx.orgId))
      .take(500);

    // Outstanding balance per client, computed from unpaid invoices.
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(5000);

    const balanceByClient = new Map<string, number>();
    const countByClient = new Map<string, number>();
    for (const inv of invoices) {
      countByClient.set(inv.clientId, (countByClient.get(inv.clientId) ?? 0) + 1);
      if (OUTSTANDING_STATUSES.has(inv.status)) {
        balanceByClient.set(
          inv.clientId,
          (balanceByClient.get(inv.clientId) ?? 0) + inv.total,
        );
      }
    }

    return clients.map((c) => ({
      ...c,
      outstandingBalance: balanceByClient.get(c._id) ?? 0,
      invoiceCount: countByClient.get(c._id) ?? 0,
    }));
  },
});

export const get = authedOrgQuery({
  args: { clientId: v.id("clients") },
  returns: v.union(
    v.object({
      _id: v.id("clients"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      outstandingBalance: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.clientsRead);
    const client = await getOrgDocOrThrow(
      ctx,
      ctx.orgId,
      "clients",
      args.clientId,
    );

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .take(5000);

    const outstandingBalance = invoices
      .filter((inv) => OUTSTANDING_STATUSES.has(inv.status))
      .reduce((sum, inv) => sum + inv.total, 0);

    return { ...client, outstandingBalance };
  },
});

export const create = authedOrgMutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("clients"),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.clientsWrite);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Client name is required");
    }
    await assertWithinClientLimit(ctx, ctx.orgId);
    return await ctx.db.insert("clients", {
      orgId: ctx.orgId,
      name,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      address: args.address?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = authedOrgMutation({
  args: {
    clientId: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.clientsWrite);
    // Ownership check — throws not-found for other orgs.
    await getOrgDocOrThrow(ctx, ctx.orgId, "clients", args.clientId);

    const patch: Partial<Doc<"clients">> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) throw new Error("Client name is required");
      patch.name = name;
    }
    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.address !== undefined)
      patch.address = args.address.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    await ctx.db.patch("clients", args.clientId, patch);
    return null;
  },
});

export const remove = authedOrgMutation({
  args: { clientId: v.id("clients") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.clientsWrite);
    await getOrgDocOrThrow(ctx, ctx.orgId, "clients", args.clientId);

    // Guard against orphaning invoices — block deletion when any exist.
    const existingInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .first();
    if (existingInvoice) {
      throw new Error(
        "Cannot delete a client with invoices. Remove its invoices first.",
      );
    }

    await ctx.db.delete("clients", args.clientId);
    return null;
  },
});
