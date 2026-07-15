import { OrganizationList } from "@clerk/nextjs";
import { BarChart3 } from "lucide-react";

export default function SelectOrgPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <BarChart3 className="size-4" />
        </span>
        Ledger Shark
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Choose an organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ledger Shark is team-based. Create a new organization or select an
          existing one to continue.
        </p>
      </div>
      <OrganizationList
        hidePersonal
        skipInvitationScreen
        afterCreateOrganizationUrl="/app"
        afterSelectOrganizationUrl="/app"
      />
    </div>
  );
}
