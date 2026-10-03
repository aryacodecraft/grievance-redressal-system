import type { Metadata } from "next";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminCharts } from "@/components/charts/AdminCharts";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default function AdminPage() {
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          Administrative Control Centre
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Triage pending grievances, review AI recommendations, and authorize department assignments.
        </p>
      </div>

      {/* Full-width content — no max-w container */}
      <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <AdminBoard />
        <AdminCharts />
      </div>
    </div>
  );
}
