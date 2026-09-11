"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MOCK_GRIEVANCES } from "@/lib/mock";

const BLUES = ["#026bc7", "#0e87ea", "#38a5f6", "#7cc5fb", "#bae0fd"];
const GREYS = ["#0f172a", "#334155", "#64748b", "#94a3b8"];

export function AdminCharts() {
  const byCategory = Object.entries(
    MOCK_GRIEVANCES.reduce<Record<string, number>>((acc, g) => {
      acc[g.category] = (acc[g.category] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const byStatus = Object.entries(
    MOCK_GRIEVANCES.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = (acc[g.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-ink-200/80 shadow-xs">
        <CardHeader title="Grievance Distribution by Department" subtitle="Volume breakdown across administrative categories" />
        <CardBody className="p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={BLUES[i % BLUES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
      <Card className="border-ink-200/80 shadow-xs">
        <CardHeader title="Current Grievances by Lifecycle State" subtitle="Real-time proportion of active vs resolved cases" />
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
