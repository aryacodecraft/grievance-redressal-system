/**
 * Role + admin-allowlist helpers.
 */

/** Emails that receive the admin role on sign-in / demo mode. */
export const ADMIN_EMAILS = [
  "admin@grievance.local", // default local dev admin
  "aryaadmin@gmail.com",   // original admin
  "admin@grievai.test",    // dev admin (local testing)
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized) || normalized.includes("admin");
}

/**
 * Demo role resolution: allowlisted admins, or any address containing "admin"
 * (so the dashboard is easy to preview locally).
 */
export function roleForEmail(email: string): "citizen" | "admin" {
  return isAdminEmail(email) ? "admin" : "citizen";
}
