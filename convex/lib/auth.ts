import type { UserIdentity } from "convex/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";

/**
 * Org RBAC model. Custom Clerk roles mapped from the feature spec.
 */
export type OrgRole = "org:owner" | "org:accountant" | "org:viewer";

/**
 * Canonical domain permissions. Prefer permission checks over role string
 * compares so billing feature-gating stays composable later.
 */
export const PERMISSIONS = {
  clientsRead: "org:clients:read",
  clientsWrite: "org:clients:write",
  invoicesRead: "org:invoices:read",
  invoicesWrite: "org:invoices:write",
  reportsRead: "org:reports:read",
  membershipsManage: "org:sys_memberships:manage",
  billingManage: "org:sys_billing:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role -> permission mapping. Used to derive permissions when the JWT does not
 * carry an explicit `org_permissions` claim (the common case for the Convex
 * JWT template). If the claim IS present it takes precedence.
 */
const OWNER_PERMISSIONS: Permission[] = [
  PERMISSIONS.clientsRead,
  PERMISSIONS.clientsWrite,
  PERMISSIONS.invoicesRead,
  PERMISSIONS.invoicesWrite,
  PERMISSIONS.reportsRead,
  PERMISSIONS.membershipsManage,
  PERMISSIONS.billingManage,
];

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  PERMISSIONS.clientsRead,
  PERMISSIONS.clientsWrite,
  PERMISSIONS.invoicesRead,
  PERMISSIONS.invoicesWrite,
  PERMISSIONS.reportsRead,
];

const VIEWER_PERMISSIONS: Permission[] = [
  PERMISSIONS.clientsRead,
  PERMISSIONS.invoicesRead,
  PERMISSIONS.reportsRead,
];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Custom roles from the feature spec.
  "org:owner": OWNER_PERMISSIONS,
  "org:accountant": ACCOUNTANT_PERMISSIONS,
  "org:viewer": VIEWER_PERMISSIONS,
  // Clerk default roles — sensible fallbacks so the app works before custom
  // roles are configured in the Dashboard. Custom roles take precedence once set.
  "org:admin": OWNER_PERMISSIONS,
  "org:member": ACCOUNTANT_PERMISSIONS,
};

export type OrgContext = {
  identity: UserIdentity;
  /** Clerk organization id, derived exclusively from the verified JWT. */
  orgId: string;
  orgRole: string | null;
  orgPermissions: string[];
};

type AnyCtx = QueryCtx | MutationCtx;

function readClaim(
  claims: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (claims[key] !== undefined && claims[key] !== null) return claims[key];
  }
  return undefined;
}

/**
 * Reads the authenticated identity and derives the active organization context.
 *
 * - `orgId` is SERVER-DERIVED ONLY, from the verified Clerk JWT. It is never
 *   accepted from function args.
 * - Throws "Not authenticated" when there is no identity.
 * - Throws "No active organization" when the identity carries no org claim.
 */
export async function getOrgContext(ctx: AnyCtx): Promise<OrgContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const claims = identity as unknown as Record<string, unknown>;

  const orgId = readClaim(claims, "org_id", "orgId") as string | undefined;
  if (!orgId) {
    throw new Error("No active organization");
  }

  const orgRole =
    (readClaim(claims, "org_role", "orgRole") as string | undefined) ?? null;

  let orgPermissions: string[] = [];
  const permClaim = readClaim(claims, "org_permissions", "orgPermissions");
  if (Array.isArray(permClaim)) {
    orgPermissions = permClaim.filter(
      (p): p is string => typeof p === "string",
    );
  } else if (typeof permClaim === "string") {
    orgPermissions = permClaim
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Always union JWT permissions with the role map. Clerk Billing can return a
  // non-empty org_permissions claim that still omits domain perms (plan-gated),
  // which would skip a "claim empty → role fallback" and lock out legit roles.
  if (orgRole && ROLE_PERMISSIONS[orgRole]) {
    orgPermissions = [
      ...new Set([...orgPermissions, ...ROLE_PERMISSIONS[orgRole]]),
    ];
  }

  return { identity, orgId, orgRole, orgPermissions };
}

/**
 * Single-document accessor for domain tables (defense in depth on top of RLS).
 *
 * Under `authedOrgQuery`/`Mutation`, `ctx.db` is RLS-wrapped so cross-org
 * `get` already returns null. This helper still normalizes missing/cross-org
 * to a consistent "Not found" (does not leak existence) and is used before
 * patch/replace/delete for clear error semantics in handlers + tests.
 */
export async function getOrgDocOrThrow<T extends TableNames>(
  ctx: AnyCtx,
  orgId: string,
  table: T,
  id: Id<T>,
): Promise<Doc<T>> {
  const doc = await ctx.db.get(table, id);
  const docOrgId = (doc as { orgId?: string } | null)?.orgId;
  if (!doc || docOrgId !== orgId) {
    throw new Error("Not found");
  }
  return doc;
}

/**
 * Reusable guard for relational writes: verifies a referenced document belongs
 * to the caller's org before linking (e.g. an invoice's client). Fails closed
 * with the same not-found error as a missing document.
 */
export function assertSameOrg(
  orgId: string,
  doc: { orgId: string } | null | undefined,
): void {
  if (!doc || doc.orgId !== orgId) {
    throw new Error("Not found");
  }
}

/**
 * RBAC check on top of org scoping. Throws "Not authorized" when the caller's
 * org context lacks the required permission.
 */
export function requireOrgPermission(
  ctx: { orgPermissions: string[] },
  permission: Permission,
): void {
  if (!ctx.orgPermissions.includes(permission)) {
    throw new Error("Not authorized");
  }
}
