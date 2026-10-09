"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Clock3, Inbox, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Feedback";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { useDemoUser } from "@/lib/session";

type NotificationItem = { id: string; kind?: string; entityId?: string; title?: string; message?: string; at?: string; isRead?: boolean };
const when = (value?: string) => value ? new Date(value).toLocaleString() : "";

export function NotificationInbox() {
  const { user, liveMode } = useDemoUser();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    try { setItems(await listNotifications() as NotificationItem[]); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load notifications"); }
    finally { setLoading(false); }
  }, []);
  // Notifications are server state and refresh periodically while this inbox is open.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!user || !liveMode) { setLoading(false); return; } void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [user, liveMode, load]);

  async function readOne(item: NotificationItem) {
    if (item.isRead) return;
    setBusyId(item.id);
    try { await markNotificationRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update notification"); }
    finally { setBusyId(""); }
  }
  async function readAll() {
    setBusyId("all");
    try { await markAllNotificationsRead(); setItems((current) => current.map((entry) => ({ ...entry, isRead: true }))); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update notifications"); }
    finally { setBusyId(""); }
  }

  if (!user) return <Card><CardBody className="py-12 text-center"><Bell className="mx-auto text-ink-400" /><h2 className="mt-3 font-semibold">Sign in to view notifications</h2><Link href="/login" className="mt-4 inline-block"><Button>Sign in</Button></Link></CardBody></Card>;
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-700"><Bell size={16} />Notifications</p><h1 className="mt-2 text-2xl font-bold text-ink-950">Your updates</h1><p className="mt-1 text-sm text-ink-600">Grievance status updates and work assignments for your account.</p></div><Button variant="outline" size="sm" disabled={!items.some((item) => !item.isRead) || busyId === "all"} onClick={() => void readAll()}><ListChecks size={15} />Mark all read</Button></div>
    {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <Card><CardHeader title="Notification inbox" subtitle={`${items.filter((item) => !item.isRead).length} unread`} />{loading ? <CardBody><Spinner label="Loading notifications…" /></CardBody> : items.length === 0 ? <CardBody className="py-12 text-center"><Inbox className="mx-auto text-ink-300" size={28} /><p className="mt-3 text-sm font-semibold text-ink-700">You’re all caught up</p><p className="mt-1 text-xs text-ink-500">New grievance updates and assigned tasks will appear here.</p></CardBody> : <div className="divide-y divide-ink-100">{items.map((item) => <div key={item.id} className={`flex gap-3 px-5 py-4 ${item.isRead ? "bg-white" : "bg-primary-50/40"}`}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.kind?.includes("assigned") ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"}`}>{item.kind?.includes("assigned") ? <ListChecks size={16} /> : <Bell size={16} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold text-ink-900">{item.title || "Grievance update"}</p><span className="inline-flex items-center gap-1 text-[11px] text-ink-500"><Clock3 size={12} />{when(item.at)}</span></div>{item.message && <p className="mt-1 text-xs leading-5 text-ink-600">{item.message}</p>}{item.entityId && <p className="mt-1 font-mono text-[10px] text-ink-500">{item.entityId}</p>}</div><div className="flex shrink-0 items-start gap-1">{item.entityId && <Link href={user.role.toUpperCase() === "USER" ? "/track" : user.role.toUpperCase() === "RESOLVER" ? "/resolver" : "/admin"} className="rounded px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50">Open</Link>}{!item.isRead && <button type="button" title="Mark as read" aria-label="Mark notification as read" disabled={busyId === item.id} onClick={() => void readOne(item)} className="rounded p-1.5 text-ink-500 hover:bg-ink-100"><Check size={15} /></button>}</div></div>)}</div>}</Card>
  </div>;
}
