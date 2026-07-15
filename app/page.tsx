import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="size-4" />
          </span>
          Ledger Shark
        </div>
        <div className="flex items-center gap-2">
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Get started</Button>
          </SignUpButton>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center">
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Accounts receivable, built for teams
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Get paid faster with{" "}
            <span className="text-primary">Ledger Shark</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Manage clients, send invoices, and track outstanding balances in one
            place. Multi-tenant, role-based, and fast.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SignUpButton mode="modal">
              <Button size="lg">
                Start free
                <ArrowRight className="size-4" />
              </Button>
            </SignUpButton>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Client management",
              body: "Keep every customer, contact, and balance organized by org.",
            },
            {
              icon: FileText,
              title: "Invoices & tax",
              body: "Build invoices with line items and tax, track status to paid.",
            },
            {
              icon: ShieldCheck,
              title: "Secure by default",
              body: "Strict org isolation and role-based access on every action.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <span className="mb-4 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ledger Shark
      </footer>
    </div>
  );
}
