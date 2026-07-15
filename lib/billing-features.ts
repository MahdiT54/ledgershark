/**
 * Canonical billing feature + plan slugs. Keeping them in one place means UI
 * gates (`has({ feature })`) and the webhook → `orgSubscriptions` sync stay
 * consistent. The exact feature→plan mapping can change without schema rewrites.
 */

export const BILLING_PLANS = {
  free: "free",
  pro: "pro",
  business: "business",
} as const;

export const BILLING_FEATURES = {
  clientsUnlimited: "clients_unlimited",
  invoicesUnlimited: "invoices_unlimited",
  reports: "reports",
  // Stubs — reserved for future phases, currently inert.
  recurring: "recurring",
  aiReceipts: "ai_receipts",
} as const;

/** Free-tier soft limits (mirrors `convex/lib/billing.ts`). */
export const FREE_LIMITS = { clients: 5, invoicesPerMonth: 10 };

/** Maps a plan slug to the feature slugs it grants. */
export const PLAN_FEATURES: Record<string, string[]> = {
  [BILLING_PLANS.free]: [BILLING_FEATURES.reports],
  [BILLING_PLANS.pro]: [
    BILLING_FEATURES.clientsUnlimited,
    BILLING_FEATURES.invoicesUnlimited,
    BILLING_FEATURES.reports,
    BILLING_FEATURES.recurring,
  ],
  [BILLING_PLANS.business]: [
    BILLING_FEATURES.clientsUnlimited,
    BILLING_FEATURES.invoicesUnlimited,
    BILLING_FEATURES.reports,
    BILLING_FEATURES.recurring,
    BILLING_FEATURES.aiReceipts,
  ],
};

export function planToFeatures(planSlug: string): string[] {
  // Clerk auto-creates `free_org` when org billing is enabled; treat it as Free.
  const normalized = planSlug === "free_org" ? BILLING_PLANS.free : planSlug;
  return PLAN_FEATURES[normalized] ?? PLAN_FEATURES[BILLING_PLANS.free];
}
