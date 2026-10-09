"use client";

import { SuperadminGate } from "@/components/superadmin/SuperadminGate";
import { SuperadminWorkspace } from "@/components/superadmin/SuperadminWorkspace";

export default function SuperadminPage() {
  return <SuperadminGate><div className="min-h-[calc(100vh-4rem)] bg-ink-50/40 px-4 py-8 sm:px-6 lg:px-8"><div className="mb-6"><h1 className="text-2xl font-bold">System administration</h1><p className="mt-1 text-sm text-ink-500">Manage user accounts, departments, and the audit log.</p></div><SuperadminWorkspace /></div></SuperadminGate>;
}
