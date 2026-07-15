/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const OWNER_A = { subject: "user_a", org_id: "org_a", org_role: "org:owner" };
const OWNER_B = { subject: "user_b", org_id: "org_b", org_role: "org:owner" };
const VIEWER_A = {
  subject: "user_a_viewer",
  org_id: "org_a",
  org_role: "org:viewer",
};
const NO_ORG = { subject: "user_no_org" };

describe("clients cross-org isolation", () => {
  test("list returns only the caller's org rows", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(OWNER_A).mutation(api.clients.create, {
      name: "Acme (A)",
    });
    await t.withIdentity(OWNER_B).mutation(api.clients.create, {
      name: "Globex (B)",
    });

    const aRows = await t.withIdentity(OWNER_A).query(api.clients.list, {});
    const bRows = await t.withIdentity(OWNER_B).query(api.clients.list, {});

    expect(aRows.map((c) => c.name)).toEqual(["Acme (A)"]);
    expect(bRows.map((c) => c.name)).toEqual(["Globex (B)"]);
  });

  test("get by a valid org-A id throws not-found for org B", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });

    await expect(
      t.withIdentity(OWNER_B).query(api.clients.get, { clientId }),
    ).rejects.toThrow("Not found");

    // Org A can still read it.
    const doc = await t
      .withIdentity(OWNER_A)
      .query(api.clients.get, { clientId });
    expect(doc?.name).toBe("Acme (A)");
  });

  test("update on an org-A id throws not-found for org B (no write occurs)", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });

    await expect(
      t
        .withIdentity(OWNER_B)
        .mutation(api.clients.update, { clientId, name: "Hacked" }),
    ).rejects.toThrow("Not found");

    const doc = await t
      .withIdentity(OWNER_A)
      .query(api.clients.get, { clientId });
    expect(doc?.name).toBe("Acme (A)");
  });

  test("remove on an org-A id throws not-found for org B", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });

    await expect(
      t.withIdentity(OWNER_B).mutation(api.clients.remove, { clientId }),
    ).rejects.toThrow("Not found");

    const doc = await t
      .withIdentity(OWNER_A)
      .query(api.clients.get, { clientId });
    expect(doc?.name).toBe("Acme (A)");
  });

  test("a call with no active org throws 'No active organization'", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.withIdentity(NO_ORG).query(api.clients.list, {}),
    ).rejects.toThrow("No active organization");
  });

  test("viewer cannot create clients (RBAC)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.withIdentity(VIEWER_A).mutation(api.clients.create, { name: "Nope" }),
    ).rejects.toThrow("Not authorized");
  });

  test("viewer can read clients (RBAC)", async () => {
    const t = convexTest(schema, modules);
    await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });
    const rows = await t.withIdentity(VIEWER_A).query(api.clients.list, {});
    expect(rows.map((c) => c.name)).toEqual(["Acme (A)"]);
  });
});
