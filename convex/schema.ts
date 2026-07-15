import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Invoice status lifecycle. MVP flow: draft -> sent -> paid, with manual
// "overdue". "viewed" reserved for future public links.
export const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("paid"),
  v.literal("overdue"),
);

// A single invoice line item. Kept as a bounded inline array on the invoice
// (invoices have a small, natural number of lines).
export const lineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  // Tax rate as a percentage, e.g. 8.25 for 8.25%.
  taxRate: v.number(),
});

export default defineSchema({
  clients: defineTable({
    // Clerk organization id — the first-class tenant key. Server-derived only.
    orgId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_name", ["orgId", "name"]),

  invoices: defineTable({
    orgId: v.string(),
    clientId: v.id("clients"),
    number: v.string(),
    status: invoiceStatusValidator,
    issueDate: v.number(),
    dueDate: v.number(),
    lineItems: v.array(lineItemValidator),
    // Fixed to USD for MVP.
    currency: v.literal("USD"),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_status", ["orgId", "status"])
    .index("by_org_and_number", ["orgId", "number"])
    .index("by_client", ["clientId"]),

  // Thin cache of Clerk org billing state, synced via billing webhooks. Used
  // for server-side feature gating and display; not required for has() checks.
  orgSubscriptions: defineTable({
    orgId: v.string(),
    planSlug: v.string(),
    status: v.string(),
    features: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),
});
