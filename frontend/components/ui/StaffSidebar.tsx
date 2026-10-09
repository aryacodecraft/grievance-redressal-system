"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Bell,
  Home,
  Inbox,
  LineChart,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NotificationBadgeLink } from "@/components/notifications/NotificationBadgeLink";

export interface SidebarLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const sharedLinks: SidebarLink[] = [];

const linksByRole: Record<string, SidebarLink[]> = {
  SUPERADMIN: [
    { href: "/", label: "Home", Icon: Home },
    { href: "/superadmin", label: "System Admin", Icon: ShieldCheck },
    { href: "/admin", label: "Grievance Queue", Icon: Inbox },
    { href: "/admin/analytics", label: "Executive Analytics", Icon: LineChart },
  ],
  ADMIN: [
    { href: "/", label: "Home", Icon: Home },
    { href: "/admin", label: "Grievance Queue", Icon: Inbox },
    { href: "/admin/employees", label: "Employees", Icon: Users },
    { href: "/admin/analytics", label: "Executive Analytics", Icon: LineChart },
  ],
  RESOLVER: [{ href: "/", label: "Home", Icon: Home }, { href: "/resolver", label: "My Work", Icon: Briefcase }],
};
for (const role of ["ADMIN", "RESOLVER", "SUPERADMIN"]) linksByRole[role].push({ href: "/notifications", label: "Notifications", Icon: Bell });

/** Per-role sidebar links; unknown/citizen roles get the shared pair only. */
export const linksForRole = (role: string | undefined, departmentId?: string | null): SidebarLink[] => {
  const links = (role && linksByRole[role]) || sharedLinks;
  return role === "ADMIN" && !departmentId
    ? links.filter((link) => link.href !== "/admin/employees")
    : links;
};

export const roleLabelOf = (role: string | undefined) =>
  role === "SUPERADMIN"
    ? "System admin"
    : role === "ADMIN"
      ? "Department admin"
      : role === "RESOLVER"
        ? "Resolver"
        : "Citizen";

/**
 * Persistent sticky sidebar that replaces the top header for staff accounts
 * (department admin, resolver, superadmin). Always visible — no overlay or
 * toggling. Collapses to a 64px icon rail below `sm` so it never crowds out
 * small viewports.
 */
export function StaffSidebar({
  links,
  email,
  roleLabel,
  onSignOut,
}: {
  links: SidebarLink[];
  email?: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const linkIsActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-ink-200 bg-white sm:w-64"
      aria-label="Staff navigation"
    >
      <Link
        href="/"
        className="flex h-14 items-center gap-3 border-b border-ink-100 px-3 sm:px-4"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary-700 font-bold text-white shadow-xs"
        >
          G
        </span>
        <span className="hidden text-sm font-bold tracking-tight text-ink-950 sm:block">
          GrievAI
        </span>
      </Link>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 sm:p-3"
        aria-label="Staff links"
      >
        {links.map(({ href, label, Icon }) => (
          href === "/notifications" ? <NotificationBadgeLink key={`${label}-${href}`} Icon={Icon} label={label} active={linkIsActive(href)} className={`flex items-center justify-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:justify-start ${linkIsActive(href) ? "bg-primary-50 text-primary-700" : "text-ink-600 hover:bg-ink-100/70 hover:text-ink-950"}`} /> : <Link
            key={`${label}-${href}`}
            href={href}
            aria-current={linkIsActive(href) ? "page" : undefined}
            title={label}
            className={`flex items-center justify-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:justify-start ${
              linkIsActive(href)
                ? "bg-primary-50 text-primary-700"
                : "text-ink-600 hover:bg-ink-100/70 hover:text-ink-950"
            }`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-2 sm:p-3">
        <p className="hidden truncate text-xs font-medium text-ink-600 sm:block">
          {email}
        </p>
        <span className="mt-1 hidden sm:inline-block rounded-sm border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-700">
          {roleLabel}
        </span>
        <button
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-200/80 hover:text-ink-950 sm:mt-3"
        >
          <LogOut size={14} className="shrink-0" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
