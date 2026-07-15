"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const invoiceId = id as Id<"invoices">;
  const data = useQuery(api.invoices.get, { invoiceId });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/app/invoices/${invoiceId}`}>
            <ArrowLeft className="size-4" />
            Back to invoice
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit invoice</h1>
      </div>

      {data === undefined ? (
        <Skeleton className="h-96 w-full" />
      ) : data === null ? (
        <p className="text-muted-foreground">Invoice not found.</p>
      ) : (
        <InvoiceForm
          invoice={{
            _id: data.invoice._id,
            clientId: data.invoice.clientId,
            issueDate: data.invoice.issueDate,
            dueDate: data.invoice.dueDate,
            notes: data.invoice.notes,
            lineItems: data.invoice.lineItems,
          }}
        />
      )}
    </div>
  );
}
