"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import type { Grievance } from "@/lib/types";

const GREYS = ["#0f172a", "#334155", "#64748b", "#94a3b8"];

/**
 * Macro distribution charts. Accepts the current grievance set so the
 * analytics page reflects live data; falls back to the mock registry.
 */
export function AdminCharts({ items = MOCK_GRIEVANCES }: { items?: Grievance[] }) {
  const byStatus = Object.entries(
    items.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = (acc[g.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-ink-200/80 shadow-xs">
        <CardHeader title="Complaints by Current Stage" subtitle="How many are active vs resolved right now" />
        <CardBody className="p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={85}
                  innerRadius={45}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={GREYS[i % GREYS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
