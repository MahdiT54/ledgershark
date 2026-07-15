"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, toDateInputValue, fromDateInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0, "≥ 0"),
  unitPrice: z.coerce.number().min(0, "≥ 0"),
  taxRate: z.coerce.number().min(0, "≥ 0"),
});

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  issueDate: z.string().min(1, "Required"),
  dueDate: z.string().min(1, "Required"),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

type FormValues = z.input<typeof schema>;

export type InvoiceFormInitial = {
  _id: Id<"invoices">;
  clientId: Id<"clients">;
  issueDate: number;
  dueDate: number;
  notes?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function InvoiceForm({
  invoice,
  defaultClientId,
}: {
  invoice?: InvoiceFormInitial;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const clients = useQuery(api.clients.list, {});
  const createInvoice = useMutation(api.invoices.create);
  const updateInvoice = useMutation(api.invoices.update);
  const isEdit = !!invoice;

  const today = toDateInputValue(Date.now());
  const in30 = toDateInputValue(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers 5.4 types are built against an earlier zod 4
    // minor; runtime is fully compatible with the installed zod 4.4.
    resolver: zodResolver(schema as never) as Resolver<FormValues>,
    defaultValues: {
      clientId: invoice?.clientId ?? defaultClientId ?? "",
      issueDate: invoice ? toDateInputValue(invoice.issueDate) : today,
      dueDate: invoice ? toDateInputValue(invoice.dueDate) : in30,
      notes: invoice?.notes ?? "",
      lineItems: invoice?.lineItems ?? [
        { description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watched = form.watch("lineItems");
  const totals = (watched ?? []).reduce(
    (acc, li) => {
      const qty = Number(li?.quantity) || 0;
      const price = Number(li?.unitPrice) || 0;
      const rate = Number(li?.taxRate) || 0;
      const net = qty * price;
      acc.subtotal += net;
      acc.tax += net * (rate / 100);
      return acc;
    },
    { subtotal: 0, tax: 0 },
  );
  const subtotal = round2(totals.subtotal);
  const tax = round2(totals.tax);
  const total = round2(subtotal + tax);

  const errors = form.formState.errors;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      clientId: values.clientId as Id<"clients">,
      issueDate: fromDateInputValue(values.issueDate),
      dueDate: fromDateInputValue(values.dueDate),
      notes: values.notes,
      lineItems: values.lineItems.map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        taxRate: Number(li.taxRate),
      })),
    };
    try {
      if (isEdit && invoice) {
        await updateInvoice({ invoiceId: invoice._id, ...payload });
        toast.success("Invoice updated");
        router.push(`/app/invoices/${invoice._id}`);
      } else {
        const id = await createInvoice(payload);
        toast.success("Invoice created");
        router.push(`/app/invoices/${id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-3">
            <Label>Client</Label>
            <Select
              value={form.watch("clientId")}
              onValueChange={(v) =>
                form.setValue("clientId", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && (
              <p className="text-sm text-destructive">
                {errors.clientId.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="issueDate">Issue date</Label>
            <Input id="issueDate" type="date" {...form.register("issueDate")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...form.register("dueDate")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Line items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ description: "", quantity: 1, unitPrice: 0, taxRate: 0 })
            }
          >
            <Plus className="size-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[1fr_80px_110px_90px_40px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>Tax %</span>
            <span />
          </div>
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_80px_110px_90px_40px] sm:border-0 sm:p-0"
            >
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="Description"
                {...form.register(`lineItems.${index}.description`)}
              />
              <Input
                type="number"
                step="any"
                placeholder="Qty"
                {...form.register(`lineItems.${index}.quantity`)}
              />
              <Input
                type="number"
                step="any"
                placeholder="Unit price"
                {...form.register(`lineItems.${index}.unitPrice`)}
              />
              <Input
                type="number"
                step="any"
                placeholder="Tax %"
                {...form.register(`lineItems.${index}.taxRate`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fields.length > 1 && remove(index)}
                disabled={fields.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {errors.lineItems && (
            <p className="text-sm text-destructive">
              {errors.lineItems.message ??
                "Check the line item values above."}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col items-end gap-1 text-sm">
          <div className="flex w-48 justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex w-48 justify-between text-muted-foreground">
            <span>Tax</span>
            <span className="tabular-nums">{formatCurrency(tax)}</span>
          </div>
          <div className="flex w-48 justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </CardFooter>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isEdit ? "Save changes" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
