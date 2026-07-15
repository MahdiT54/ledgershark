import type { Rules, RLSConfig } from "convex-helpers/server/rowLevelSecurity";
import type { DataModel } from "../_generated/dataModel";

/**
 * Rule context for org-scoped RLS. Built once per request after JWT auth —
 * `orgId` is the server-derived Clerk organization id.
 */
export type OrgRlsCtx = { orgId: string };

/** Fail closed: tables without an explicit rule are inaccessible. */
export const RLS_CONFIG: RLSConfig = { defaultPolicy: "deny" };

/**
 * Per-document access rules for every domain table. Same predicate for
 * read / modify / insert: the row's `orgId` must match the caller's org.
 *
 * Combined with `wrapDatabaseReader` / `wrapDatabaseWriter` in
 * `authedOrgQuery` / `authedOrgMutation`, this is the DB-layer
 * cross-org isolation from the convex-helpers RLS pattern.
 *
 * Note: rules do not apply recursively inside rule functions themselves.
 */
export function orgRlsRules(orgId: string): Rules<OrgRlsCtx, DataModel> {
  const sameOrg = async (_ctx: OrgRlsCtx, doc: { orgId: string }) =>
    doc.orgId === orgId;

  return {
    clients: {
      read: sameOrg,
      modify: sameOrg,
      insert: sameOrg,
    },
    invoices: {
      read: sameOrg,
      modify: sameOrg,
      insert: sameOrg,
    },
    orgSubscriptions: {
      read: sameOrg,
      modify: sameOrg,
      insert: sameOrg,
    },
  };
}
