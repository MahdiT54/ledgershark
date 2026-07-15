import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/app/invoices">
            <ArrowLeft className="size-4" />
            Invoices
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      </div>
      <InvoiceForm defaultClientId={clientId} />
    </div>
  );
}
