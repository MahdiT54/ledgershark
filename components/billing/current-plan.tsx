"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FREE_LIMITS } from "@/lib/billing-features";
import { formatDate } from "@/lib/format";

export function CurrentPlan() {
  const sub = useQuery(api.billing.getSubscription);

  if (sub === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full max-w-sm" />
        </CardContent>
      </Card>
    );
  }

  const planSlug = sub?.planSlug ?? "free";
  const status = sub?.status ?? "active";
  const isFree = planSlug === "free";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="capitalize">{planSlug} plan</CardTitle>
          <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
            {status.replace(/_/g, " ")}
          </Badge>
        </div>
        <CardDescription>
          {sub
            ? `Last updated ${formatDate(sub.updatedAt)}`
            : "No paid subscription yet — you're on the free plan."}
        </CardDescription>
      </CardHeader>
      {isFree && (
        <CardContent className="text-sm text-muted-foreground">
          Free plan includes up to {FREE_LIMITS.clients} clients and{" "}
          {FREE_LIMITS.invoicesPerMonth} invoices per month. Upgrade below to
          remove limits.
        </CardContent>
      )}
    </Card>
  );
}
