"use client";

import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { StaffSidebar, linksForRole, roleLabelOf } from "./StaffSidebar";
import { useDemoUser } from "@/lib/session";

/**
 * Chooses the page chrome from the signed-in role:
 *
 * - Staff (ADMIN / RESOLVER / SUPERADMIN): no top header — a persistent
 *   sticky left sidebar (StaffSidebar) holds navigation and the account
 *   footer; page content and the site footer sit in the right column.
 * - Citizens / logged out: the original sticky SiteHeader on top.
 *
 * Layout only — no gating; each page keeps its own AdminGate/ResolverGate.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useDemoUser();
  const role = user?.role?.toUpperCase();
  const isStaff = role === "ADMIN" || role === "SUPERADMIN" || role === "RESOLVER";

  if (isStaff) {
    return (
      <div className="flex min-h-screen w-full">
        <StaffSidebar
          links={linksForRole(role, user?.departmentId)}
          email={user?.email || user?.citizen_id || user?.name || undefined}
          roleLabel={roleLabelOf(role)}
          onSignOut={signOut}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 bg-white">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white">{children}</main>
      <SiteFooter />
    </>
  );
}
