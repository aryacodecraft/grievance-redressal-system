"use client";

import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminNav";

export default function AdminPage() {
  return (
    <AdminGate>
      <div className="bg-white min-h-[calc(100vh-4rem)]">
        <AdminHeader
          title="Administrative Control Centre"
          subtitle="Review new complaints, see the AI's suggestion, and hand each case to the right department team."
        />
        <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          <AdminBoard />
        </div>
      </div>
    </AdminGate>
  );
}
