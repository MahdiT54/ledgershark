# Ledger Shark

Accounts receivable for teams — manage clients, invoices, and cash flow. A
multi-tenant B2B app built on **Clerk** (organizations, RBAC, billing),
**Convex** (org-scoped realtime backend), and **Next.js + shadcn/ui**.

## Stack

- **Convex** — database + server functions, org-scoped by construction
- **Clerk** — auth, Organizations, custom roles/permissions, Billing
- **Next.js (App Router)** — hosting + routing
- **shadcn/ui** (`radix-nova`) + Tailwind — UI
- **react-hook-form + zod** — forms & validation
- **Vitest + convex-test** — cross-org isolation tests

## Getting started

```bash
pnpm install
pnpm dev        # runs Next.js + `convex dev` together
```

`pnpm dev` starts the app and the Convex dev deployment. Run the isolation test
suite with:

```bash
pnpm test
```

## Environment variables

Local (`.env.local`):

```bash
NEXT_PUBLIC_CONVEX_URL=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Clerk routing
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app

# Clerk webhook signature verification (from the Clerk Dashboard endpoint)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Shared secret guarding the Convex billing sync mutation. Must match the
# value set on the Convex deployment (see below).
BILLING_WEBHOOK_SECRET=...
```

On the **Convex deployment** (Dashboard → Settings → Environment Variables, or
`npx convex env set`):

```bash
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-subdomain>.clerk.accounts.dev
BILLING_WEBHOOK_SECRET=...   # same value as in .env.local
```

## Clerk Dashboard / CLI setup (one-time)

`clerk doctor` and `clerk config pull` confirm the **LedgerShark** Linked Dev
instance already has Organizations (membership required / force selection),
custom roles (`org:owner` creator, `org:accountant` default), org Billing, and
plans (`free` / `pro` / `business`) with the feature slugs in
[`lib/billing-features.ts`](lib/billing-features.ts).

If you recreate the Clerk app, redo these:

1. **Organizations** — `npx clerk@latest enable orgs --force-selection`
2. **Roles & permissions** — `org:owner` / `org:accountant` / `org:viewer` with
   `org:clients:*`, `org:invoices:*`, `org:reports:read`; Creator = `org:owner`.
   The app also falls back to Clerk defaults (`org:admin` → owner,
   `org:member` → accountant).
3. **Convex JWT template** — include `org_id`, `org_role`, `org_permissions`.
4. **Billing** — `npx clerk@latest enable billing --for orgs`
5. **Organization Plans** — `free` / `pro` / `business` + feature slugs above.
6. **Webhook** — `/api/webhooks/clerk` for `subscription.*` /
   `subscriptionItem.*`; set `CLERK_WEBHOOK_SIGNING_SECRET`.

Free-tier soft limits (5 clients, 10 invoices/month) are enforced server-side in
Convex regardless of Clerk plan sync.

## Security model

Cross-org isolation is a hard invariant: `orgId` is derived only from the
verified Clerk JWT (never from client args), every domain function goes through
the `authedOrgQuery` / `authedOrgMutation` wrappers, single-doc reads use
`getOrgDocOrThrow`, and relational writes use `assertSameOrg`. This is verified
by the two-org isolation suite in `convex/*.test.ts` (`pnpm test`).

## Project structure

- `app/` — Next.js routes (`/`, auth, `/app/*` dashboard, `/api/webhooks/clerk`)
- `components/` — app shell + feature UI (`clients/`, `invoices/`, `billing/`)
- `convex/` — schema, org-scoped functions, `lib/` auth + billing helpers, tests
- `lib/`, `hooks/` — client helpers (formatting, permissions, billing constants)
