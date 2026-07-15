import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { AppSidebar } from "@/components/app-sidebar";
import { AppAuthGate } from "@/components/app-auth-gate";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  // Defense in depth — middleware already enforces these.
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="text-sm font-medium text-muted-foreground">
            Ledger Shark
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">
          <AppAuthGate>{children}</AppAuthGate>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
