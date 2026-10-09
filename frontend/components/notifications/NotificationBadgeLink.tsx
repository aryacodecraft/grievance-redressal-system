"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { listNotifications } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import { useToast } from "@/components/ui/ToastProvider";

export function NotificationBadgeLink({ Icon, label = "Notifications", active = false, compact = false, className = "" }: { Icon: LucideIcon; label?: string; active?: boolean; compact?: boolean; className?: string }) {
  const { user, liveMode } = useDemoUser();
  const { notify } = useToast();
  const [unread, setUnread] = useState(0);
  const knownIds = useRef<Set<string> | null>(null);
  const knownUserId = useRef<string | null>(null);
  const load = useCallback(async () => {
    if (!user || !liveMode) return;
    try {
      const rows = await listNotifications() as Array<{ id?: string; title?: string; message?: string; isRead?: boolean }>;
      setUnread(rows.filter((row) => !row.isRead).length);
      const currentIds = new Set(rows.map((row) => row.id).filter((id): id is string => Boolean(id)));
      // Don't mistake an account's existing notifications for newly arrived
      // notifications when the app switches users in the same browser.
      if (knownUserId.current !== user.id) {
        knownUserId.current = user.id;
        knownIds.current = currentIds;
        return;
      }
      if (knownIds.current) {
        const arriving = rows.filter((row) => row.id && !knownIds.current?.has(row.id));
        for (const item of arriving.slice(0, 2)) notify(item.title || "New notification", item.message || "Open your inbox to see the update.", "info");
      }
      knownIds.current = currentIds;
    } catch { /* inbox itself presents backend errors */ }
  }, [user, liveMode, notify]);
  // Polling synchronizes the unread badge with server-owned notification state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const interval = window.setInterval(() => void load(), 30000); return () => window.clearInterval(interval); }, [load]);
  return <Link href="/notifications" aria-current={active ? "page" : undefined} aria-label={`${label}${unread ? `, ${unread} unread` : ""}`} title={label} className={className}>
    <span className="relative inline-flex shrink-0"><Icon size={compact ? 17 : 18} />{unread > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>}</span>
    {!compact && <span>{label}</span>}
  </Link>;
}
