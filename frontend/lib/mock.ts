"use client";

import type { Grievance } from "./types";

export const MOCK_GRIEVANCES: Grievance[] = [
  {
    id: "GRV-2026-0142",
    title: "Potholes on MG Road near bus stand",
    description:
      "Multiple deep potholes have formed after the recent rains. Two-wheeler riders are at risk, especially at night when the street lights are off.",
    status: "in_progress",
    category: "roads",
    priority: "high",
    createdAt: "2026-09-08T09:24:00Z",
    latitude: 12.9716,
    longitude: 77.5946,
    assignee: "Roads Division — Zone 3",
    hfEngine: {
      category: "roads",
      priority: "high",
      isUrgent: true,
      keywords: ["potholes", "bus stand", "street lights", "risk"],
      explanation:
        "Category 'roads' inferred from road-surface terms; priority 'high' from safety-risk language and night-time hazard mention.",
      categoryConfidence: 0.91,
    },
  },
  {
    id: "GRV-2026-0139",
    title: "Irregular water supply in Sector 12",
    description:
      "Tap water supply has been irregular for six days. Tankers arrive late and leave before all households are served.",
    status: "assigned",
    category: "water",
    priority: "medium",
    createdAt: "2026-09-06T14:05:00Z",
    assignee: "Water Supply Board — Sector 12",
    hfEngine: {
      category: "water",
      priority: "medium",
      isUrgent: false,
      keywords: ["water supply", "tankers", "households"],
      explanation:
        "Category 'water' inferred from supply terms; priority 'medium' from sustained multi-day disruption affecting many households.",
      categoryConfidence: 0.87,
    },
  },
  {
    id: "GRV-2026-0131",
    title: "Street lights not working on Park Avenue",
    description:
      "Five consecutive street lights are not working. Residents have reported the issue twice already.",
    status: "open",
    category: "electricity",
    priority: "low",
    createdAt: "2026-09-03T19:41:00Z",
    hfEngine: {
      category: "electricity",
      priority: "low",
      isUrgent: false,
      keywords: ["street lights"],
      explanation:
        "Category 'electricity' inferred from lighting terms; priority 'low' — no immediate safety language detected.",
      categoryConfidence: 0.83,
    },
  },
  {
    id: "GRV-2026-0127",
    title: "Garbage not collected for a week",
    description:
      "Overflowing bins near the market entrance are causing foul smell and stray animals. Needs urgent clearing.",
    status: "resolved",
    category: "sanitation",
    priority: "medium",
    createdAt: "2026-08-30T08:12:00Z",
    assignee: "Sanitation Dept — Ward 7",
    hfEngine: {
      category: "sanitation",
      priority: "medium",
      isUrgent: false,
      keywords: ["garbage", "bins", "market"],
      explanation:
        "Category 'sanitation' inferred from waste terms; priority raised to 'medium' per sanitation handling rules.",
      categoryConfidence: 0.89,
    },
  },
];

export function findMockGrievance(id: string): Grievance | undefined {
  return MOCK_GRIEVANCES.find(
    (g) => g.id.toLowerCase() === id.trim().toLowerCase()
  );
}
