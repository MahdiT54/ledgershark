"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { FileText, Plus } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, type InvoiceStatus } from "@/components/invoices/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export default function InvoicesPage() {
  const [filter, setFilter] = useState<string>("all");
  const invoices = useQuery(
    api.invoices.list,
    filter === "all" ? {} : { status: filter as InvoiceStatus },
  );
  const { canWriteInvoices } = usePermissions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Create and track invoices to their paid status.
          </p>
        </div>
        {canWriteInvoices && (
          <Button asChild>
            <Link href="/app/invoices/new">
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <div className="overflow-x-auto">
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {invoices === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </span>
          <div>
            <p className="font-medium">No invoices here</p>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Create your first invoice to get started."
                : "No invoices match this filter."}
            </p>
          </div>
          {canWriteInvoices && filter === "all" && (
            <Button asChild>
              <Link href="/app/invoices/new">
                <Plus className="size-4" />
                New invoice
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {invoices.map((inv) => (
              <Link
                key={inv._id}
                href={`/app/invoices/${inv._id}`}
                className="block rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{inv.number}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {inv.clientName}
                    </p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Due {formatDate(inv.dueDate)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(inv.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/invoices/${inv._id}`}
                        className="hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.clientName}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(inv.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
