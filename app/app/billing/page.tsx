import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PricingTable } from "@clerk/nextjs";
import { CurrentPlan } from "@/components/billing/current-plan";

export default async function BillingPage() {
  const { orgRole } = await auth();

  // Defense-in-depth: the sidebar link is already permission-gated, but guard
  // the route itself too. Billing management is owner/admin only. (System
  // permissions like `org:sys_billing:manage` aren't in server session claims,
  // so we gate on role here.)
  const canManageBilling = orgRole === "org:owner" || orgRole === "org:admin";
  if (!canManageBilling) {
    redirect("/app");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization&apos;s plan and subscription.
        </p>
      </div>

      <CurrentPlan />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Plans</h2>
        <PricingTable for="organization" />
      </div>
    </div>
  );
}
