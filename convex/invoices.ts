import { v } from "convex/values";
import { authedOrgQuery, authedOrgMutation } from "./lib/orgFunctions";
import {
  getOrgDocOrThrow,
  assertSameOrg,
  requireOrgPermission,
  PERMISSIONS,
} from "./lib/auth";
import { assertWithinInvoiceLimit } from "./lib/billing";
import { invoiceStatusValidator, lineItemValidator } from "./schema";
import type { Infer } from "convex/values";
import type { QueryCtx } from "./_generated/server";

type LineItem = Infer<typeof lineItemValidator>;

const invoiceDoc = v.object({
  _id: v.id("invoices"),
  _creationTime: v.number(),
  orgId: v.string(),
  clientId: v.id("clients"),
  number: v.string(),
  status: invoiceStatusValidator,
  issueDate: v.number(),
  dueDate: v.number(),
  lineItems: v.array(lineItemValidator),
  currency: v.literal("USD"),
  subtotal: v.number(),
  tax: v.number(),
  total: v.number(),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Compute subtotal, tax, and total from line items (server-side, trusted). */
function computeTotals(lineItems: LineItem[]) {
  let subtotal = 0;
  let tax = 0;
  for (const li of lineItems) {
    const lineNet = li.quantity * li.unitPrice;
    subtotal += lineNet;
    tax += lineNet * (li.taxRate / 100);
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

function validateLineItems(lineItems: LineItem[]) {
  if (lineItems.length === 0) {
    throw new Error("An invoice needs at least one line item");
  }
  for (const li of lineItems) {
    if (li.description.trim().length === 0) {
      throw new Error("Line item description is required");
    }
    if (li.quantity < 0 || li.unitPrice < 0 || li.taxRate < 0) {
      throw new Error("Line item values must be non-negative");
    }
  }
}

/** Generate the next per-org invoice number: INV-<year>-<seq>. */
async function nextInvoiceNumber(
  ctx: QueryCtx,
  orgId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const existing = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(10000);

  let maxSeq = 0;
  for (const inv of existing) {
    if (inv.number.startsWith(prefix)) {
      const seq = parseInt(inv.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export const list = authedOrgQuery({
  args: { status: v.optional(invoiceStatusValidator) },
  returns: v.array(
    v.object({
      _id: v.id("invoices"),
      _creationTime: v.number(),
      orgId: v.string(),
      clientId: v.id("clients"),
      clientName: v.string(),
      number: v.string(),
      status: invoiceStatusValidator,
      issueDate: v.number(),
      dueDate: v.number(),
      subtotal: v.number(),
      tax: v.number(),
      total: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesRead);

    const invoices = args.status
      ? await ctx.db
          .query("invoices")
          .withIndex("by_org_and_status", (q) =>
            q.eq("orgId", ctx.orgId).eq("status", args.status!),
          )
          .order("desc")
          .take(1000)
      : await ctx.db
          .query("invoices")
          .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
          .order("desc")
          .take(1000);

    // Resolve client names (bounded set).
    const clientIds = [...new Set(invoices.map((i) => i.clientId))];
    const nameById = new Map<string, string>();
    for (const id of clientIds) {
      const c = await ctx.db.get("clients", id);
      if (c) nameById.set(id, c.name);
    }

    return invoices.map((inv) => ({
      _id: inv._id,
      _creationTime: inv._creationTime,
      orgId: inv.orgId,
      clientId: inv.clientId,
      clientName: nameById.get(inv.clientId) ?? "Unknown client",
      number: inv.number,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: inv.subtotal,
      tax: inv.tax,
      total: inv.total,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }));
  },
});

export const listByClient = authedOrgQuery({
  args: { clientId: v.id("clients") },
  returns: v.array(
    v.object({
      _id: v.id("invoices"),
      number: v.string(),
      status: invoiceStatusValidator,
      issueDate: v.number(),
      dueDate: v.number(),
      total: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesRead);
    // Ensure the client belongs to this org before listing its invoices.
    await getOrgDocOrThrow(ctx, ctx.orgId, "clients", args.clientId);

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(1000);

    return invoices.map((inv) => ({
      _id: inv._id,
      number: inv.number,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
    }));
  },
});

export const get = authedOrgQuery({
  args: { invoiceId: v.id("invoices") },
  returns: v.union(
    v.object({
      invoice: invoiceDoc,
      client: v.object({
        _id: v.id("clients"),
        name: v.string(),
        email: v.optional(v.string()),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesRead);
    const invoice = await getOrgDocOrThrow(
      ctx,
      ctx.orgId,
      "invoices",
      args.invoiceId,
    );
    const client = await getOrgDocOrThrow(
      ctx,
      ctx.orgId,
      "clients",
      invoice.clientId,
    );
    return {
      invoice,
      client: { _id: client._id, name: client.name, email: client.email },
    };
  },
});

export const create = authedOrgMutation({
  args: {
    clientId: v.id("clients"),
    issueDate: v.number(),
    dueDate: v.number(),
    lineItems: v.array(lineItemValidator),
    notes: v.optional(v.string()),
    status: v.optional(invoiceStatusValidator),
  },
  returns: v.id("invoices"),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesWrite);

    // Relational write guard: the referenced client MUST belong to this org.
    const client = await ctx.db.get("clients", args.clientId);
    assertSameOrg(ctx.orgId, client);

    await assertWithinInvoiceLimit(ctx, ctx.orgId);
    validateLineItems(args.lineItems);
    const totals = computeTotals(args.lineItems);
    const now = Date.now();
    const number = await nextInvoiceNumber(ctx, ctx.orgId);

    return await ctx.db.insert("invoices", {
      orgId: ctx.orgId,
      clientId: args.clientId,
      number,
      status: args.status ?? "draft",
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      lineItems: args.lineItems,
      currency: "USD",
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedOrgMutation({
  args: {
    invoiceId: v.id("invoices"),
    clientId: v.optional(v.id("clients")),
    issueDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    lineItems: v.optional(v.array(lineItemValidator)),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesWrite);
    const invoice = await getOrgDocOrThrow(
      ctx,
      ctx.orgId,
      "invoices",
      args.invoiceId,
    );

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.clientId !== undefined && args.clientId !== invoice.clientId) {
      const client = await ctx.db.get("clients", args.clientId);
      assertSameOrg(ctx.orgId, client);
      patch.clientId = args.clientId;
    }
    if (args.issueDate !== undefined) patch.issueDate = args.issueDate;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.lineItems !== undefined) {
      validateLineItems(args.lineItems);
      const totals = computeTotals(args.lineItems);
      patch.lineItems = args.lineItems;
      patch.subtotal = totals.subtotal;
      patch.tax = totals.tax;
      patch.total = totals.total;
    }

    await ctx.db.patch("invoices", args.invoiceId, patch);
    return null;
  },
});

export const updateStatus = authedOrgMutation({
  args: { invoiceId: v.id("invoices"), status: invoiceStatusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesWrite);
    await getOrgDocOrThrow(ctx, ctx.orgId, "invoices", args.invoiceId);
    await ctx.db.patch("invoices", args.invoiceId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = authedOrgMutation({
  args: { invoiceId: v.id("invoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.invoicesWrite);
    await getOrgDocOrThrow(ctx, ctx.orgId, "invoices", args.invoiceId);
    await ctx.db.delete("invoices", args.invoiceId);
    return null;
  },
});
