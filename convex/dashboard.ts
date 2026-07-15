import { v } from "convex/values";
import { authedOrgQuery } from "./lib/orgFunctions";
import { requireOrgPermission, PERMISSIONS } from "./lib/auth";

const OUTSTANDING_STATUSES = new Set(["sent", "viewed", "overdue"]);

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const metrics = authedOrgQuery({
  // `now` is supplied by the client so the query stays deterministic/cacheable.
  args: { now: v.number(), monthsBack: v.optional(v.number()) },
  returns: v.object({
    outstandingTotal: v.number(),
    collectedTotal: v.number(),
    clientCount: v.number(),
    counts: v.object({
      draft: v.number(),
      sent: v.number(),
      viewed: v.number(),
      paid: v.number(),
      overdue: v.number(),
    }),
    revenueByMonth: v.array(
      v.object({
        month: v.string(),
        collected: v.number(),
        outstanding: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    requireOrgPermission(ctx, PERMISSIONS.reportsRead);

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(10000);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(10000);

    const counts = { draft: 0, sent: 0, viewed: 0, paid: 0, overdue: 0 };
    let outstandingTotal = 0;
    let collectedTotal = 0;

    // Build month window.
    const monthsBack = args.monthsBack ?? 6;
    const window: string[] = [];
    const base = new Date(args.now);
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1),
      );
      window.push(monthKey(d.getTime()));
    }
    const collectedByMonth = new Map<string, number>();
    const outstandingByMonth = new Map<string, number>();

    for (const inv of invoices) {
      counts[inv.status] += 1;
      const mk = monthKey(inv.issueDate);
      if (inv.status === "paid") {
        collectedTotal += inv.total;
        collectedByMonth.set(mk, (collectedByMonth.get(mk) ?? 0) + inv.total);
      } else if (OUTSTANDING_STATUSES.has(inv.status)) {
        outstandingTotal += inv.total;
        outstandingByMonth.set(
          mk,
          (outstandingByMonth.get(mk) ?? 0) + inv.total,
        );
      }
    }

    const revenueByMonth = window.map((month) => ({
      month,
      collected: Math.round((collectedByMonth.get(month) ?? 0) * 100) / 100,
      outstanding: Math.round((outstandingByMonth.get(month) ?? 0) * 100) / 100,
    }));

    return {
      outstandingTotal: Math.round(outstandingTotal * 100) / 100,
      collectedTotal: Math.round(collectedTotal * 100) / 100,
      clientCount: clients.length,
      counts,
      revenueByMonth,
    };
  },
});
