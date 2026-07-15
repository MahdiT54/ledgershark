"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, Mail, MapPin, Phone, Plus } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
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
import { ClientFormSheet } from "@/components/clients/client-form-sheet";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const client = useQuery(api.clients.get, { clientId });
  const invoices = useQuery(api.invoices.listByClient, { clientId });
  const { canWriteClients, canWriteInvoices } = usePermissions();

  if (client === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/clients">
            <ArrowLeft className="size-4" />
            Back to clients
          </Link>
        </Button>
        <p className="text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/app/clients">
              <ArrowLeft className="size-4" />
              Clients
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
        </div>
        {canWriteClients && (
          <ClientFormSheet
            client={{
              _id: client._id,
              name: client.name,
              email: client.email,
              phone: client.phone,
              address: client.address,
              notes: client.notes,
            }}
          >
            <Button variant="outline">Edit client</Button>
          </ClientFormSheet>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              {client.email ?? "No email"}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" />
              {client.phone ?? "No phone"}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" />
              {client.address ?? "No address"}
            </div>
            {client.notes && (
              <p className="pt-2 text-muted-foreground">{client.notes}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Outstanding balance</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(client.outstandingBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoice history</h2>
          {canWriteInvoices && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/invoices/new?clientId=${client._id}`}>
                <Plus className="size-4" />
                New invoice
              </Link>
            </Button>
          )}
        </div>

        {invoices === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No invoices for this client yet.
          </p>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead className="hidden sm:table-cell">Due</TableHead>
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
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(inv.issueDate)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
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
        )}
      </div>
    </div>
  );
}
