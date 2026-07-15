"use client";

import { useAuth } from "@clerk/nextjs";

const WRITE_ROLES = ["org:owner", "org:accountant", "org:admin", "org:member"];
const OWNER_ROLES = ["org:owner", "org:admin"];

/**
 * Client-side permission checks mirroring the Convex server RBAC. Prefers
 * Clerk `has({ permission })`, falling back to role membership so the UI works
 * before custom permissions/roles are configured in the Dashboard.
 */
export function usePermissions() {
  const { has, orgRole } = useAuth();

  const can = (permission: string, fallbackRoles: string[]): boolean => {
    if (has?.({ permission })) return true;
    return orgRole ? fallbackRoles.includes(orgRole) : false;
  };

  return {
    canWriteClients: can("org:clients:write", WRITE_ROLES),
    canWriteInvoices: can("org:invoices:write", WRITE_ROLES),
    canManageBilling: can("org:sys_billing:manage", OWNER_ROLES),
  };
}
