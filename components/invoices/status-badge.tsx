import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  viewed: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("capitalize", STATUS_STYLES[status])}
    >
      {status}
    </Badge>
  );
}
