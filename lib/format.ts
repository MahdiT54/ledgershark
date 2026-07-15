export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}

/** For <input type="date"> value binding (YYYY-MM-DD in UTC). */
export function toDateInputValue(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD date input into a UTC timestamp. */
export function fromDateInputValue(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}
