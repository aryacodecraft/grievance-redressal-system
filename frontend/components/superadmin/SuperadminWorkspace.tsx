"use client";

import { useCallback, useEffect, useState } from "react";
import { adminResetFace, createDepartment, getPublicConfig, listAudit, listDepartments, listUsers, revokeUserFaceTemplate, setUserActive, updateUserRole, updateDepartment } from "@/lib/api";
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
  // Revoke-face and reset-face only exist when the backend flag is on (DEC-024).
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [resetTokenInfo, setResetTokenInfo] = useState<{ userLabel: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => { const [u, d, a] = await Promise.all([listUsers(), listDepartments(), listAudit()]); setUsers(u as Record<string, unknown>[]); setDepartments(d as Record<string, unknown>[]); setAudit(a as Record<string, unknown>[]); }, []);
  // Load the protected management snapshot after the session is mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload().catch((e) => setError(e instanceof Error ? e.message : "Could not load system data")); }, [reload]);
  useEffect(() => { void getPublicConfig().then((cfg) => setFaceEnabled(cfg.faceAuthEnabled)); }, []);

  async function changeUser(id: string, action: () => Promise<unknown>) { setBusy(id); setError(""); try { await action(); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); } finally { setBusy(""); } }

  async function handleResetFace(id: string, userLabel: string) {
    setBusy(id);
    setError("");
    try {
      const res = await adminResetFace(id);
      setResetTokenInfo({ userLabel, token: res.re_enroll_token });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy("");
    }
  }

  return <div className="space-y-6">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {resetTokenInfo && (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-amber-900">
              Re-enrollment token generated for {resetTokenInfo.userLabel}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              This one-time token is valid for 24 hours. Provide it to the citizen in person so they can re-enroll their face login. It will not be shown again.
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-amber-700 hover:text-amber-900 underline"
            onClick={() => setResetTokenInfo(null)}
          >
            Dismiss
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="block flex-1 rounded bg-white p-2 font-mono text-xs border border-amber-200 select-all break-all">
            {resetTokenInfo.token}
          </code>
          <button
            type="button"
            className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
            onClick={() => {
              void navigator.clipboard.writeText(resetTokenInfo.token);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied!" : "Copy Token"}
          </button>
        </div>
      </div>
    )}
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardBody><p className="text-xs uppercase text-ink-500">Users</p><p className="mt-1 text-3xl font-bold">{users.length}</p></CardBody></Card><Card><CardBody><p className="text-xs uppercase text-ink-500">Departments</p><p className="mt-1 text-3xl font-bold">{departments.length}</p></CardBody></Card><Card><CardBody><p className="text-xs uppercase text-ink-500">Audit events</p><p className="mt-1 text-3xl font-bold">{audit.length}</p></CardBody></Card></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader title="User accounts" subtitle="Role and department overview" /><CardBody className="space-y-2">{users.map((u) => { const id = String(u.id); const active = u.isActive !== false; const userLabel = String(u.full_name || u.citizen_id || u.email || "Citizen"); const userSub = String(u.citizen_id ? `Citizen ID: ${u.citizen_id}` : (u.email || u.phone || "Face login account")); const isFaceOnly = u.auth_method === "face_only" || u.authMethod === "face_only"; return <div key={id} className="border-b border-ink-100 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div><p className="font-semibold">{userLabel}</p><p className="text-xs text-ink-500">{userSub}</p></div><Badge tone={active ? "emerald" : "rose"}>{String(u.role)} · {active ? "active" : "inactive"}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><select aria-label={`Role for ${userLabel}`} className="h-8 rounded border border-ink-200 bg-white px-2 text-xs" value={String(u.role)} disabled={busy === id} onChange={(e) => void changeUser(id, () => updateUserRole(id, e.target.value, "Superadmin role management"))}><option>USER</option><option>RESOLVER</option><option>ADMIN</option><option>SUPERADMIN</option></select><button className="rounded border border-ink-200 px-2 py-1 text-xs hover:bg-ink-50" disabled={busy === id} onClick={() => void changeUser(id, () => setUserActive(id, !active, "Superadmin account management"))}>{active ? "Deactivate" : "Activate"}</button>{faceEnabled && isFaceOnly && <button className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100" disabled={busy === id} title="Reset face login for this citizen and generate a single-use re-enrollment token" onClick={() => void handleResetFace(id, userLabel)}>Reset face login</button>}{faceEnabled && <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" disabled={busy === id} title="Delete this user's stored face template" onClick={() => void changeUser(id, () => revokeUserFaceTemplate(id))}>Revoke face</button>}</div></div>; })}</CardBody></Card><Card><CardHeader title="Departments" subtitle="Departments currently in use" /><CardBody className="space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"><Input aria-label="New department name" placeholder="Department name" value={newName} onChange={(e) => setNewName(e.target.value)} /><Input aria-label="New department code" placeholder="Short code" value={newKey} onChange={(e) => setNewKey(e.target.value)} /><Button disabled={!newName.trim() || !newKey.trim() || Boolean(busy)} onClick={() => void changeUser("new-department", async () => { await createDepartment({ name: newName.trim(), key: newKey.trim().toLowerCase(), reason: "Superadmin department creation" }); setNewName(""); setNewKey(""); })}>Add</Button></div>{departments.map((d) => { const id = String(d.id ?? d.key); const active = d.isActive !== false; return <div key={id} className="flex items-center justify-between gap-2 border-b border-ink-100 py-2 text-sm"><span className="font-semibold">{String(d.name)}</span><div className="flex items-center gap-2"><span className="font-mono text-xs text-ink-500">{String(d.key)}</span><button className="rounded border border-ink-200 px-2 py-1 text-xs hover:bg-ink-50" onClick={() => void changeUser(id, () => updateDepartment(id, { isActive: !active, reason: "Superadmin department management" }))}>{active ? "Disable" : "Enable"}</button></div></div>; })}</CardBody></Card></div>
    <Card><CardHeader title="Recent audit activity" /><CardBody className="space-y-2">{audit.slice(-20).reverse().map((a, i) => <div key={i} className="rounded bg-ink-50 p-2 text-xs"><span className="font-semibold">{String(a.action ?? "event")}</span> · {String(a.actorRole ?? "") } · {String(a.at ?? "")}</div>)}</CardBody></Card>
  </div>;
}
