"use client";

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientFormSheet } from "@/components/clients/client-form-sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClientRow = {
  _id: Id<"clients">;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  invoiceCount: number;
  outstandingBalance: number;
};

function ClientActions({
  client,
  onRemove,
}: {
  client: ClientRow;
  onRemove: (clientId: Id<"clients">) => Promise<unknown>;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
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
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </ClientFormSheet>
      <ConfirmDialog
        title={`Delete ${client.name}?`}
        description="This permanently removes the client. Clients with invoices can't be deleted."
        confirmLabel="Delete"
        successMessage="Client deleted"
        onConfirm={async () => {
          await onRemove(client._id);
        }}
      >
        <Button variant="ghost" size="icon-sm">
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </ConfirmDialog>
    </div>
  );
}

export default function ClientsPage() {
  const clients = useQuery(api.clients.list, {});
  const removeClient = useMutation(api.clients.remove);
  const { canWriteClients } = usePermissions();

  const handleRemove = async (clientId: Id<"clients">) => {
    await removeClient({ clientId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage the customers you invoice.
          </p>
        </div>
        {canWriteClients && (
          <ClientFormSheet>
            <Button>
              <Plus className="size-4" />
              New client
            </Button>
          </ClientFormSheet>
        )}
      </div>

      {clients === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </span>
          <div>
            <p className="font-medium">No clients yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first client to start creating invoices.
            </p>
          </div>
          {canWriteClients && (
            <ClientFormSheet>
              <Button>
                <Plus className="size-4" />
                New client
              </Button>
            </ClientFormSheet>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {clients.map((c) => (
              <div
                key={c._id}
                className="rounded-xl border bg-card p-4 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/app/clients/${c._id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.email && (
                      <p className="truncate text-sm text-muted-foreground">
                        {c.email}
                      </p>
                    )}
                  </div>
                  {canWriteClients && (
                    <ClientActions client={c} onRemove={handleRemove} />
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {c.invoiceCount} invoice{c.invoiceCount === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(c.outstandingBalance)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/clients/${c._id}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.invoiceCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.outstandingBalance)}
                    </TableCell>
                    <TableCell>
                      {canWriteClients && (
                        <ClientActions client={c} onRemove={handleRemove} />
                      )}
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
