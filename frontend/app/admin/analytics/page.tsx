"use client";

import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminNav";

export default function AdminAnalyticsPage() {
  return (
    <AdminGate>
      <div className="bg-white min-h-[calc(100vh-4rem)]">
        <AdminHeader
          title="Administrative Control Centre"
          subtitle="The big picture: complaint numbers, common problems, and where they're happening."
        />
        <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          <AdminAnalytics />
        </div>
      </div>
    </AdminGate>
  );
}
