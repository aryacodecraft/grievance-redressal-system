"use client";

import { useCallback, useEffect, useState } from "react";
import { createDepartment, listAudit, listDepartments, listUsers, setUserActive, updateUserRole, updateDepartment } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function SuperadminWorkspace() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [departments, setDepartments] = useState<Record<string, unknown>[]>([]);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const reload = useCallback(async () => { const [u, d, a] = await Promise.all([listUsers(), listDepartments(), listAudit()]); setUsers(u as Record<string, unknown>[]); setDepartments(d as Record<string, unknown>[]); setAudit(a as Record<string, unknown>[]); }, []);
  // Load the protected management snapshot after the session is mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload().catch((e) => setError(e instanceof Error ? e.message : "Could not load system data")); }, [reload]);
  async function changeUser(id: string, action: () => Promise<unknown>) { setBusy(id); setError(""); try { await action(); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); } finally { setBusy(""); } }
  return <div className="space-y-6">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardBody><p className="text-xs uppercase text-ink-500">Users</p><p className="mt-1 text-3xl font-bold">{users.length}</p></CardBody></Card><Card><CardBody><p className="text-xs uppercase text-ink-500">Departments</p><p className="mt-1 text-3xl font-bold">{departments.length}</p></CardBody></Card><Card><CardBody><p className="text-xs uppercase text-ink-500">Audit events</p><p className="mt-1 text-3xl font-bold">{audit.length}</p></CardBody></Card></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader title="User accounts" subtitle="Role and department overview" /><CardBody className="space-y-2">{users.map((u) => { const id = String(u.id); const active = u.isActive !== false; return <div key={id} className="border-b border-ink-100 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div><p className="font-semibold">{String(u.full_name ?? u.email)}</p><p className="text-xs text-ink-500">{String(u.email)}</p></div><Badge tone={active ? "emerald" : "rose"}>{String(u.role)} · {active ? "active" : "inactive"}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><select aria-label={`Role for ${String(u.email)}`} className="h-8 rounded border border-ink-200 bg-white px-2 text-xs" value={String(u.role)} disabled={busy === id} onChange={(e) => void changeUser(id, () => updateUserRole(id, e.target.value, "Superadmin role management"))}><option>USER</option><option>RESOLVER</option><option>ADMIN</option><option>SUPERADMIN</option></select><button className="rounded border border-ink-200 px-2 py-1 text-xs hover:bg-ink-50" disabled={busy === id} onClick={() => void changeUser(id, () => setUserActive(id, !active, "Superadmin account management"))}>{active ? "Deactivate" : "Activate"}</button></div></div>; })}</CardBody></Card><Card><CardHeader title="Departments" subtitle="Active organizational units" /><CardBody className="space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"><Input aria-label="New department name" placeholder="Department name" value={newName} onChange={(e) => setNewName(e.target.value)} /><Input aria-label="New department key" placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} /><Button disabled={!newName.trim() || !newKey.trim() || Boolean(busy)} onClick={() => void changeUser("new-department", async () => { await createDepartment({ name: newName.trim(), key: newKey.trim().toLowerCase(), reason: "Superadmin department creation" }); setNewName(""); setNewKey(""); })}>Add</Button></div>{departments.map((d) => { const id = String(d.id ?? d.key); const active = d.isActive !== false; return <div key={id} className="flex items-center justify-between gap-2 border-b border-ink-100 py-2 text-sm"><span className="font-semibold">{String(d.name)}</span><div className="flex items-center gap-2"><span className="font-mono text-xs text-ink-500">{String(d.key)}</span><button className="rounded border border-ink-200 px-2 py-1 text-xs hover:bg-ink-50" onClick={() => void changeUser(id, () => updateDepartment(id, { isActive: !active, reason: "Superadmin department management" }))}>{active ? "Disable" : "Enable"}</button></div></div>; })}</CardBody></Card></div>
    <Card><CardHeader title="Recent audit activity" /><CardBody className="space-y-2">{audit.slice(-20).reverse().map((a, i) => <div key={i} className="rounded bg-ink-50 p-2 text-xs"><span className="font-semibold">{String(a.action ?? "event")}</span> · {String(a.actorRole ?? "") } · {String(a.at ?? "")}</div>)}</CardBody></Card>
  </div>;
}
