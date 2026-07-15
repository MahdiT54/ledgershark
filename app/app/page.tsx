"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DollarSign, FileWarning, Users, Wallet } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  collected: { label: "Collected", color: "var(--chart-1)" },
  outstanding: { label: "Outstanding", color: "var(--chart-3)" },
} satisfies ChartConfig;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
  });
}

export default function DashboardPage() {
  // Snapshot "now" once on mount (lazy state init keeps render pure and gives
  // the org-scoped dashboard query a deterministic timestamp).
  const [now] = useState(Date.now);
  const data = useQuery(api.dashboard.metrics, { now, monthsBack: 6 });

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Revenue and outstanding balances for your organization.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const cards = [
    {
      label: "Outstanding",
      value: formatCurrency(data.outstandingTotal),
      icon: Wallet,
    },
    {
      label: "Collected",
      value: formatCurrency(data.collectedTotal),
      icon: DollarSign,
    },
    { label: "Clients", value: String(data.clientCount), icon: Users },
    {
      label: "Overdue invoices",
      value: String(data.counts.overdue),
      icon: FileWarning,
    },
  ];

  const chartData = data.revenueByMonth.map((r) => ({
    ...r,
    label: monthLabel(r.month),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Revenue and outstanding balances for your organization.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>{c.label}</CardDescription>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collected vs outstanding</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => formatCurrency(Number(v))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="collected"
                fill="var(--color-collected)"
                radius={4}
              />
              <Bar
                dataKey="outstanding"
                fill="var(--color-outstanding)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
