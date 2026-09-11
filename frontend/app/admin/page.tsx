import type { Metadata } from "next";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminCharts } from "@/components/charts/AdminCharts";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
        Admin Dashboard
      </h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        Pending assignments, at-risk queue, and analytics summary. Demo data —
        live Firestore wiring is a follow-up.
      </p>
      <div className="mt-6">
        <AdminBoard />
      </div>
      <div className="mt-6">
        <AdminCharts />
      </div>
    </div>
  );
}
