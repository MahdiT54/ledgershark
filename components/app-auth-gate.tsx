"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Gates Convex-query-driven UI until the Convex client is actually
 * authenticated.
 *
 * Middleware already guarantees a signed-in user with an active org, but on a
 * fresh page load there is a brief window where Clerk has not yet handed the
 * auth token to the Convex client. Rendering queries during that window makes
 * them run unauthenticated and throw "Not authenticated". `useConvexAuth`
 * (via these components) is the source of truth for "can Convex-authed UI
 * render", per the Convex + Clerk guidance.
 */
export function AppAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </AuthLoading>

      <Authenticated>{children}</Authenticated>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <div>
            <p className="font-medium">Reconnecting your session</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&apos;t verify your session with the server. This usually
              resolves on its own — if it persists, sign out and back in.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => location.reload()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      </Unauthenticated>
    </>
  );
}
