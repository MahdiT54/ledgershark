import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { planToFeatures } from "@/lib/billing-features";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Minimal shape of Clerk billing webhook payloads. Clerk's typed union does not
 * yet cover `subscription.*` events in every SDK version, so we read defensively.
 */
type BillingPayload = {
  status?: string;
  payer?: { organization_id?: string; user_id?: string };
  items?: Array<{ plan?: { slug?: string }; status?: string }>;
  plan?: { slug?: string };
};

const BILLING_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.past_due",
  "subscriptionItem.updated",
  "subscriptionItem.active",
]);

export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) {
    console.error("BILLING_WEBHOOK_SECRET is not set");
    return new Response("Server not configured", { status: 500 });
  }

  if (BILLING_EVENTS.has(evt.type)) {
    const data = evt.data as unknown as BillingPayload;
    const orgId = data.payer?.organization_id;

    // Only org-scoped subscriptions are relevant to this B2B app.
    if (orgId) {
      const planSlug =
        data.items?.[0]?.plan?.slug ?? data.plan?.slug ?? "free";
      const status = data.status ?? data.items?.[0]?.status ?? "active";
      const features = planToFeatures(planSlug);

      try {
        await convex.mutation(api.billing.syncSubscription, {
          secret,
          orgId,
          planSlug,
          status,
          features,
        });
      } catch (err) {
        console.error("Failed to sync subscription to Convex", err);
        return new Response("Sync failed", { status: 500 });
      }
    }
  }

  return new Response("OK", { status: 200 });
}
