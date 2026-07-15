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

const LINE_ITEMS = [
  { description: "Consulting", quantity: 2, unitPrice: 100, taxRate: 10 },
];

async function seedInvoice(
  t: ReturnType<typeof convexTest>,
  identity: Parameters<ReturnType<typeof convexTest>["withIdentity"]>[0],
) {
  const clientId = await t
    .withIdentity(identity)
    .mutation(api.clients.create, { name: "Client" });
  const invoiceId = await t.withIdentity(identity).mutation(api.invoices.create, {
    clientId,
    issueDate: Date.UTC(2026, 0, 1),
    dueDate: Date.UTC(2026, 0, 31),
    lineItems: LINE_ITEMS,
  });
  return { clientId, invoiceId };
}

describe("invoices totals + numbering", () => {
  test("totals are computed server-side from line items", async () => {
    const t = convexTest(schema, modules);
    const { invoiceId } = await seedInvoice(t, OWNER_A);
    const result = await t
      .withIdentity(OWNER_A)
      .query(api.invoices.get, { invoiceId });
    expect(result?.invoice.subtotal).toBe(200);
    expect(result?.invoice.tax).toBe(20);
    expect(result?.invoice.total).toBe(220);
    expect(result?.invoice.number).toMatch(/^INV-\d{4}-0001$/);
  });

  test("invoice numbers increment per org", async () => {
    const t = convexTest(schema, modules);
    await seedInvoice(t, OWNER_A);
    const { invoiceId } = await seedInvoice(t, OWNER_A);
    const second = await t
      .withIdentity(OWNER_A)
      .query(api.invoices.get, { invoiceId });
    expect(second?.invoice.number).toMatch(/^INV-\d{4}-0002$/);
  });
});

describe("invoices cross-org isolation", () => {
  test("list returns only the caller's org invoices", async () => {
    const t = convexTest(schema, modules);
    await seedInvoice(t, OWNER_A);
    await seedInvoice(t, OWNER_B);

    const aRows = await t.withIdentity(OWNER_A).query(api.invoices.list, {});
    const bRows = await t.withIdentity(OWNER_B).query(api.invoices.list, {});
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    expect(aRows[0].orgId).toBe("org_a");
    expect(bRows[0].orgId).toBe("org_b");
  });

  test("get by a valid org-A invoice id throws not-found for org B", async () => {
    const t = convexTest(schema, modules);
    const { invoiceId } = await seedInvoice(t, OWNER_A);
    await expect(
      t.withIdentity(OWNER_B).query(api.invoices.get, { invoiceId }),
    ).rejects.toThrow("Not found");
  });

  test("updateStatus on an org-A invoice throws not-found for org B", async () => {
    const t = convexTest(schema, modules);
    const { invoiceId } = await seedInvoice(t, OWNER_A);
    await expect(
      t
        .withIdentity(OWNER_B)
        .mutation(api.invoices.updateStatus, { invoiceId, status: "paid" }),
    ).rejects.toThrow("Not found");

    const result = await t
      .withIdentity(OWNER_A)
      .query(api.invoices.get, { invoiceId });
    expect(result?.invoice.status).toBe("draft");
  });

  test("remove on an org-A invoice throws not-found for org B", async () => {
    const t = convexTest(schema, modules);
    const { invoiceId } = await seedInvoice(t, OWNER_A);
    await expect(
      t.withIdentity(OWNER_B).mutation(api.invoices.remove, { invoiceId }),
    ).rejects.toThrow("Not found");
  });

  test("creating an invoice in org B referencing an org-A client is rejected", async () => {
    const t = convexTest(schema, modules);
    const clientIdA = await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });

    await expect(
      t.withIdentity(OWNER_B).mutation(api.invoices.create, {
        clientId: clientIdA,
        issueDate: Date.UTC(2026, 0, 1),
        dueDate: Date.UTC(2026, 0, 31),
        lineItems: LINE_ITEMS,
      }),
    ).rejects.toThrow("Not found");
  });

  test("viewer cannot create invoices (RBAC)", async () => {
    const t = convexTest(schema, modules);
    const clientId = await t
      .withIdentity(OWNER_A)
      .mutation(api.clients.create, { name: "Acme (A)" });
    await expect(
      t.withIdentity(VIEWER_A).mutation(api.invoices.create, {
        clientId,
        issueDate: Date.UTC(2026, 0, 1),
        dueDate: Date.UTC(2026, 0, 31),
        lineItems: LINE_ITEMS,
      }),
    ).rejects.toThrow("Not authorized");
  });
});
