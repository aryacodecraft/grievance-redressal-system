const DEPARTMENT_ALIASES: Record<string, string> = {
  water: "water", watersupply: "water", watersupplyandsewerageboard: "water",
  road: "roads", roads: "roads", transport: "roads", transportation: "roads",
  roadtransport: "roads", roadsandtransport: "roads", roadandtransport: "roads",
  roadsinfrastructureauthority: "roads", roadsandtransportauthority: "roads",
  trafficandtransportoperations: "roads",
  electricity: "electricity", power: "electricity", electricityandpowerdistribution: "electricity",
  sanitation: "sanitation", waste: "sanitation", municipalsanitationandwaste: "sanitation",
  health: "health", publichealthandmedicalservices: "health",
  governance: "governance", civicgovernanceandcitizenservices: "governance",
  other: "other", generalurbanadministration: "other",
};

export function canonicalDepartmentId(value?: string | null): string {
  const key = (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.includes("road") || key.includes("transport")) return "roads";
  return DEPARTMENT_ALIASES[key] ?? key;
}

export interface DepartmentDefinition {
  key: string;
  label: string;
  shortLabel: string;
}

export const DEPARTMENTS: DepartmentDefinition[] = [
  { key: "water", label: "Water Supply & Sewerage Board", shortLabel: "Water Supply" },
  { key: "roads", label: "Roads & Transport Authority", shortLabel: "Roads & Transport" },
  { key: "electricity", label: "Electricity & Power Distribution", shortLabel: "Electricity" },
  { key: "sanitation", label: "Municipal Sanitation & Waste", shortLabel: "Sanitation" },
  { key: "health", label: "Public Health & Medical Services", shortLabel: "Health Services" },
  { key: "governance", label: "Civic Governance & Citizen Services", shortLabel: "Governance" },
  { key: "other", label: "General Urban Administration", shortLabel: "Other" },
];

export function getDepartmentLabel(keyOrCategory?: string | null, short = false): string {
  const canonical = canonicalDepartmentId(keyOrCategory);
  const found = DEPARTMENTS.find((d) => d.key === canonical);
  if (found) {
    return short ? found.shortLabel : found.label;
  }
  const raw = (keyOrCategory ?? "Other").trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

