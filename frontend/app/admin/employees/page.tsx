"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminNav";
import { DepartmentEmployeesWorkspace } from "@/components/admin/DepartmentEmployeesWorkspace";

export default function DepartmentEmployeesPage() {
  return <AdminGate><div className="min-h-screen bg-white"><AdminHeader title="Department Employees" subtitle="Manage employee accounts and distribute your department’s work." /><main className="space-y-6 px-4 py-8 sm:px-6 lg:px-8"><DepartmentEmployeesWorkspace /></main></div></AdminGate>;
}
