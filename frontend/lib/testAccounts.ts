/**
 * Testing-phase seed accounts shown in the dev credentials box on /login.
 *
 * Must match backend/app/seed_test_accounts.py (emails, roles, department
 * keys) and its built-in default passwords. If SEED_TEST_PASSWORD is set
 * on the backend, these defaults no longer apply — enter that password
 * manually instead.
 */

export interface TestAccount {
  label: string;
  email: string;
  password: string;
  role: string;
  group: "Citizen" | "Admins" | "Managers" | "Employees";
}

const MANAGER_PASSWORD = "Manager@2026!";
const EMPLOYEE_PASSWORD = "Resolver@2026!";

const DEPARTMENTS: Array<{ key: string; label: string }> = [
  { key: "water", label: "Water" },
  { key: "roads", label: "Roads" },
  { key: "transport", label: "Transport" },
  { key: "electricity", label: "Electricity" },
  { key: "sanitation", label: "Sanitation" },
  { key: "health", label: "Health" },
  { key: "governance", label: "Governance" },
  { key: "other", label: "Other" },
];

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    label: "Citizen",
    email: "citizen@grievance.local",
    password: "Citizen@2026!",
    role: "USER",
    group: "Citizen",
  },
  {
    label: "Admin",
    email: "admin@grievance.local",
    password: "Admin@2026!",
    role: "ADMIN",
    group: "Admins",
  },
  {
    label: "Superadmin",
    email: "superadmin@grievance.local",
    password: "SuperAdmin@2026!",
    role: "SUPERADMIN",
    group: "Admins",
  },
  ...DEPARTMENTS.map((d) => ({
    label: `${d.label} Manager`,
    email: `${d.key}.manager@grievance.local`,
    password: MANAGER_PASSWORD,
    role: "ADMIN",
    group: "Managers" as const,
  })),
  ...DEPARTMENTS.map((d) => ({
    label: `${d.label} Employee`,
    email: `${d.key}.employee@grievance.local`,
    password: EMPLOYEE_PASSWORD,
    role: "RESOLVER",
    group: "Employees" as const,
  })),
];
