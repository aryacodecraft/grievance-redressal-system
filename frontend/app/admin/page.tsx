import type { Metadata } from "next";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminCharts } from "@/components/charts/AdminCharts";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default function AdminPage() {
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-950">
            Administrative Control Center
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Triage pending grievances, review AI recommendations, and authorize department assignments.
          </p>
        </div>
        <div className="space-y-8">
          <AdminBoard />
          <AdminCharts />
        </div>
      </div>
    </div>
  );
}
