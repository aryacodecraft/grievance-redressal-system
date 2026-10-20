"use client";

import { useState } from "react";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import type { Grievance } from "@/lib/types";

import { canonicalDepartmentId, getDepartmentLabel } from "@/lib/departments";

const GREYS = ["#ff6b00", "#18181b", "#3f3f46", "#71717a"];

/**
 * Macro distribution charts. Accepts the current grievance set so the
 * analytics page reflects live data; falls back to the mock registry.
 */
export function AdminCharts({ items = MOCK_GRIEVANCES }: { items?: Grievance[] }) {
  const [department, setDepartment] = useState("all");
  const departments = Array.from(new Set(items.map((g) => canonicalDepartmentId(g.departmentId ?? g.category)))).sort();
  const filteredItems = department === "all"
    ? items
    : items.filter((g) => canonicalDepartmentId(g.departmentId ?? g.category) === department);
  const byStatus = Object.entries(
    filteredItems.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = (acc[g.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  return (
    <Card className="w-full border-ink-200/80 shadow-xs">
      <CardHeader
        title="Complaints by Current Stage"
        subtitle="How many are active vs resolved right now"
        action={
          <div className="w-52 shrink-0">
            <label className="sr-only" htmlFor="stage-department-filter">Filter by department</label>
            <Select id="stage-department-filter" value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="all">All departments</option>
              {departments.map((key) => <option key={key} value={key}>{getDepartmentLabel(key)}</option>)}
            </Select>
          </div>
        }
      />
      <CardBody className="p-4 sm:p-5">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                innerRadius={50}
                paddingAngle={3}
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
              >
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={GREYS[i % GREYS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}
