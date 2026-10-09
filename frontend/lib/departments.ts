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
