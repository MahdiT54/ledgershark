import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes: landing, auth flows, and the Clerk webhook endpoint.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

// Everything under /app requires an authenticated user with an active org.
const isAppRoute = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  // Enforce authentication for all non-public routes (redirects to sign-in).
  await auth.protect();

  // Pure B2B: /app requires an active organization. Users without one are
  // sent to the org selection/creation flow.
  if (isAppRoute(req)) {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.redirect(new URL("/select-org", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
