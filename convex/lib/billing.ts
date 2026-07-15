import type { MutationCtx } from "../_generated/server";

/**
 * Free-tier soft limits. Kept small for the MVP demo. Enforced server-side so
 * they can't be bypassed from the client. Mirrored (for display/UI) in
 * `lib/billing-features.ts`.
 */
export const FREE_LIMITS = { clients: 5, invoicesPerMonth: 10 };

export const BILLING_FEATURES = {
  clientsUnlimited: "clients_unlimited",
  invoicesUnlimited: "invoices_unlimited",
} as const;

async function getEntitlements(
  ctx: MutationCtx,
  orgId: string,
): Promise<{ planSlug: string; features: string[] }> {
  const sub = await ctx.db
    .query("orgSubscriptions")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (!sub) return { planSlug: "free", features: [] };
  return { planSlug: sub.planSlug, features: sub.features };
}

/** Blocks creating clients beyond the free limit unless entitled. */
export async function assertWithinClientLimit(
  ctx: MutationCtx,
  orgId: string,
): Promise<void> {
  const { features } = await getEntitlements(ctx, orgId);
  if (features.includes(BILLING_FEATURES.clientsUnlimited)) return;

  const existing = await ctx.db
    .query("clients")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(FREE_LIMITS.clients + 1);

  if (existing.length >= FREE_LIMITS.clients) {
    throw new Error(
      `Free plan limit reached (${FREE_LIMITS.clients} clients). Upgrade your plan to add more.`,
    );
  }
}

/** Blocks creating invoices beyond the free monthly limit unless entitled. */
export async function assertWithinInvoiceLimit(
  ctx: MutationCtx,
  orgId: string,
): Promise<void> {
  const { features } = await getEntitlements(ctx, orgId);
  if (features.includes(BILLING_FEATURES.invoicesUnlimited)) return;

  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const recent = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .take(1000);

  const thisMonth = recent.filter((i) => i.createdAt >= monthStart).length;
  if (thisMonth >= FREE_LIMITS.invoicesPerMonth) {
    throw new Error(
      `Free plan limit reached (${FREE_LIMITS.invoicesPerMonth} invoices this month). Upgrade your plan to add more.`,
    );
  }
}
