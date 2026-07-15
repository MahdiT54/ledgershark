import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { authedOrgQuery } from "./lib/orgFunctions";
import { requireOrgPermission, PERMISSIONS } from "./lib/auth";

/** Read the active org's subscription for display in the billing UI. */
export const getSubscription = authedOrgQuery({
  args: {},
  returns: v.union(
    v.object({
      planSlug: v.string(),
      status: v.string(),
      features: v.array(v.string()),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    requireOrgPermission(ctx, PERMISSIONS.reportsRead);
    const sub = await ctx.db
      .query("orgSubscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .first();
    if (!sub) return null;
    return {
      planSlug: sub.planSlug,
      status: sub.status,
      features: sub.features,
      updatedAt: sub.updatedAt,
    };
  },
});

/**
 * Server-to-server subscription sync, called by the verified Clerk billing
 * webhook route.
 *
 * `orgId` is supplied by the (already Clerk-signature-verified) webhook
 * payload — it is NOT user authorization. This endpoint is guarded by a shared
 * secret (`BILLING_WEBHOOK_SECRET`, set on the Convex deployment) so it cannot
 * be invoked by arbitrary clients.
 */
export const syncSubscription = mutation({
  args: {
    secret: v.string(),
    orgId: v.string(),
    planSlug: v.string(),
    status: v.string(),
    features: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expected = process.env.BILLING_WEBHOOK_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("orgSubscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const patch = {
      orgId: args.orgId,
      planSlug: args.planSlug,
      status: args.status,
      features: args.features,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch("orgSubscriptions", existing._id, patch);
    } else {
      await ctx.db.insert("orgSubscriptions", patch);
    }
    return null;
  },
});
