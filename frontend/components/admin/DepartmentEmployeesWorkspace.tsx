"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Feedback";
import { createEmployee, deleteEmployee, listUsers, reassignGrievance } from "@/lib/api";
import type { Grievance } from "@/lib/types";
import { useDemoUser } from "@/lib/session";
import { useAdminGrievanceFeed } from "./useAdminGrievanceFeed";
import { useToast } from "@/components/ui/ToastProvider";

type Employee = { id: string; full_name?: string; email?: string; departmentId?: string; role?: string; isActive?: boolean };
const canonicalDepartment = (value?: string | null) => value?.toLowerCase() === "transport" ? "roads" : (value ?? "").toLowerCase();
const openStates = new Set(["SUBMITTED", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "ESCALATED", "REOPENED"]);

export function DepartmentEmployeesWorkspace() {
  const { user, liveMode } = useDemoUser();
  const { notify } = useToast();
  const { items: grievances, loading: loadingGrievances } = useAdminGrievanceFeed();
  const departmentId = canonicalDepartment(user?.departmentId);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [selectedEmployee, setSelectedEmployee] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshEmployees() {
    setLoadingEmployees(true);
    try {
      const rows = await listUsers() as Employee[];
      setEmployees(rows.filter((row) => row.role === "RESOLVER" && row.departmentId && canonicalDepartment(row.departmentId) === departmentId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load employees");
    } finally {
      setLoadingEmployees(false);
    }
  }

  // Employee records are server state and are fetched when the manager scope is known.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (liveMode && departmentId) void refreshEmployees(); }, [liveMode, departmentId]);

  const departmentGrievances = useMemo(() => grievances.filter((g) => canonicalDepartment(g.departmentId ?? g.category) === departmentId && openStates.has((g.state ?? g.status).toUpperCase())), [grievances, departmentId]);
  const activeWork = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const grievance of departmentGrievances) if (grievance.ownerId) counts[grievance.ownerId] = (counts[grievance.ownerId] ?? 0) + 1;
    return counts;
  }, [departmentGrievances]);

  async function create() {
    setBusy(true); setMessage("");
    try {
      await createEmployee({ ...form, departmentId });
      setForm({ full_name: "", email: "", password: "" });
      await refreshEmployees();
      setMessage("Employee account created.");
      notify("Employee account created", `${form.full_name} can now sign in to your department.`);
    } catch (error) { const text = error instanceof Error ? error.message : "Could not create employee"; setMessage(text); notify("Could not create employee", text, "error"); }
    finally { setBusy(false); }
  }

  async function remove(employee: Employee) {
    if (activeWork[employee.id]) return;
    setBusy(true); setMessage("");
    try {
      await deleteEmployee(employee.id);
      setEmployees((current) => current.filter((entry) => entry.id !== employee.id));
      setMessage("Employee account removed.");
      notify("Employee account removed", employee.full_name || employee.email);
    } catch (error) { const text = error instanceof Error ? error.message : "Could not remove employee"; setMessage(text); notify("Could not remove employee", text, "error"); }
    finally { setBusy(false); }
  }

  async function assign(grievance: Grievance) {
    const employeeId = selectedEmployee[grievance.id];
    if (!employeeId) return;
    setBusy(true); setMessage("");
    try {
      await reassignGrievance(grievance.id, { ownerId: employeeId, departmentId, reason: "Department manager assigned task" });
      setMessage(`Task ${grievance.id} assigned.`);
      notify("Task assigned", `${grievance.id} was assigned to ${employees.find((employee) => employee.id === employeeId)?.full_name || "the selected employee"}.`);
      await refreshEmployees();
    } catch (error) { const text = error instanceof Error ? error.message : "Could not assign task"; setMessage(text); notify("Could not assign task", text, "error"); }
    finally { setBusy(false); }
  }

  if (!departmentId) return <Card><CardBody><p className="text-sm text-ink-600">This workspace is for department managers. Your account needs a department assignment.</p></CardBody></Card>;
  if (!liveMode) return <Card><CardBody><p className="text-sm text-ink-600">Connect to the backend to manage department employee accounts and assignments.</p></CardBody></Card>;

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-ink-950">Department employees</h2><p className="mt-1 text-sm text-ink-600">Manage {departmentId === "roads" ? "Roads & Transport" : departmentId} accounts and distribute open grievances within your team.</p></div>
    <div className="space-y-6">
      <Card><CardHeader title="Create employee account" subtitle="New accounts belong to your department automatically." /><CardBody><div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"><label className="text-xs font-semibold text-ink-600">Name<Input className="mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Employee name" /></label><label className="text-xs font-semibold text-ink-600">Email<Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></label><label className="text-xs font-semibold text-ink-600">Temporary password<Input className="mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label><Button disabled={busy || !form.full_name.trim() || !form.email.trim() || form.password.length < 8} onClick={() => void create()}><UserPlus size={15} />Create employee</Button></div></CardBody></Card>
      <Card><CardHeader title="Employees in your department" subtitle={`${employees.length} employee account${employees.length === 1 ? "" : "s"}`} /><CardBody>{loadingEmployees ? <Spinner label="Loading employees…" /> : employees.length === 0 ? <p className="text-sm text-ink-500">No employee accounts in this department yet.</p> : <div className="divide-y divide-ink-100">{employees.map((employee) => <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-700"><Users size={17} /></span><div><p className="text-sm font-semibold text-ink-900">{employee.full_name || "Employee"}</p><p className="text-xs text-ink-500">{employee.email} · {activeWork[employee.id] ?? 0} open tasks</p></div></div><Button variant="outline" size="sm" disabled={busy || Boolean(activeWork[employee.id])} title={activeWork[employee.id] ? "Reassign this employee’s open tasks before removing the account." : "Remove employee account"} onClick={() => void remove(employee)}>Remove account</Button></div>)}</div>}</CardBody></Card>
    </div>
    <div>
      <Card><CardHeader title="Assign department tasks" subtitle="Choose an employee for each open grievance in this department." /><CardBody>{loadingGrievances ? <Spinner label="Loading department tasks…" /> : departmentGrievances.length === 0 ? <p className="text-sm text-ink-500">No open department grievances need employee assignment.</p> : <div className="space-y-2">{departmentGrievances.map((grievance) => <div key={grievance.id} className="grid gap-3 rounded-md border border-ink-100 p-3 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-mono text-[11px] text-ink-500">{grievance.id} · {(grievance.state ?? grievance.status).replaceAll("_", " ")}</p><p className="mt-1 text-sm font-semibold text-ink-900">{grievance.title}</p><p className="mt-1 text-xs text-ink-500">{grievance.ownerId ? `Assigned to ${employees.find((employee) => employee.id === grievance.ownerId)?.full_name ?? "an employee"}` : "Not yet assigned to an employee"}</p></div><Select value={selectedEmployee[grievance.id] ?? grievance.ownerId ?? ""} onChange={(e) => setSelectedEmployee((current) => ({ ...current, [grievance.id]: e.target.value }))}><option value="">Select employee</option>{employees.filter((employee) => employee.isActive !== false).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email}</option>)}</Select><Button disabled={busy || !selectedEmployee[grievance.id] || !employees.length} onClick={() => void assign(grievance)}><BriefcaseBusiness size={15} />Assign task</Button></div>)}</div>}</CardBody></Card>
    </div>
    {message && <p role="status" className="text-sm text-primary-700">{message}</p>}
  </div>;
}
