"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Send, CheckCircle2, AlertTriangle } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/invoices/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const invoiceId = id as Id<"invoices">;
  const router = useRouter();
  const data = useQuery(api.invoices.get, { invoiceId });
  const updateStatus = useMutation(api.invoices.updateStatus);
  const removeInvoice = useMutation(api.invoices.remove);
  const { canWriteInvoices } = usePermissions();

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/invoices">
            <ArrowLeft className="size-4" />
            Back to invoices
          </Link>
        </Button>
        <p className="text-muted-foreground">Invoice not found.</p>
      </div>
    );
  }

  const { invoice, client } = data;

  const setStatus = async (status: "sent" | "paid" | "overdue") => {
    try {
      await updateStatus({ invoiceId, status });
      toast.success(`Invoice marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/app/invoices">
              <ArrowLeft className="size-4" />
              Invoices
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.number}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>
        </div>
        {canWriteInvoices && (
          <div className="flex flex-wrap gap-2">
            {invoice.status === "draft" && (
              <Button onClick={() => setStatus("sent")}>
                <Send className="size-4" />
                Send
              </Button>
            )}
            {invoice.status !== "paid" && (
              <Button variant="outline" onClick={() => setStatus("paid")}>
                <CheckCircle2 className="size-4" />
                Mark paid
              </Button>
            )}
            {(invoice.status === "sent" || invoice.status === "viewed") && (
              <Button variant="outline" onClick={() => setStatus("overdue")}>
                <AlertTriangle className="size-4" />
                Mark overdue
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/app/invoices/${invoice._id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <ConfirmDialog
              title={`Delete ${invoice.number}?`}
              description="This permanently deletes the invoice."
              confirmLabel="Delete"
              successMessage="Invoice deleted"
              onConfirm={async () => {
                await removeInvoice({ invoiceId });
                router.push("/app/invoices");
              }}
            >
              <Button variant="ghost">Delete</Button>
            </ConfirmDialog>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billed to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/app/clients/${client._id}`}
              className="font-medium hover:underline"
            >
              {client.name}
            </Link>
            <p className="text-muted-foreground">{client.email ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Issued</span>
              <span>{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span>Due</span>
              <span>{formatDate(invoice.dueDate)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Tax %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((li, i) => (
                <TableRow key={i}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {li.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(li.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {li.taxRate}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(li.quantity * li.unitPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div className="flex w-48 justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex w-48 justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular-nums">{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex w-48 justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>

          {invoice.notes && (
            <p className="mt-4 text-sm text-muted-foreground">{invoice.notes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
