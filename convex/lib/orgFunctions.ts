import {
  customQuery,
  customMutation,
  customCtx,
} from "convex-helpers/server/customFunctions";
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import { query, mutation } from "../_generated/server";
import { getOrgContext } from "./auth";
import { orgRlsRules, RLS_CONFIG } from "./rls";

/**
 * The ONLY sanctioned entry points for org-scoped domain tables.
 *
 * These wrappers:
 * 1. Call `getOrgContext` (JWT-derived `orgId`, never from args)
 * 2. Wrap `ctx.db` with convex-helpers RLS so every get/query/insert/patch/
 *    replace/delete is checked against `doc.orgId === ctx.orgId`
 * 3. Inject org context onto `ctx` for handlers / RBAC
 *
 * Using bare `query`/`mutation` for domain tables is disallowed — it would
 * bypass both auth and RLS. Exception: trusted server-to-server endpoints
 * (e.g. billing webhook sync) that use their own shared-secret guard.
 *
 * Pattern: https://github.com/get-convex/convex-helpers#row-level-security
 */
export const authedOrgQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const org = await getOrgContext(ctx);
    const rlsCtx = { orgId: org.orgId };
    return {
      ...org,
      db: wrapDatabaseReader(rlsCtx, ctx.db, orgRlsRules(org.orgId), RLS_CONFIG),
    };
  }),
);

export const authedOrgMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const org = await getOrgContext(ctx);
    const rlsCtx = { orgId: org.orgId };
    return {
      ...org,
      db: wrapDatabaseWriter(rlsCtx, ctx.db, orgRlsRules(org.orgId), RLS_CONFIG),
    };
  }),
);
