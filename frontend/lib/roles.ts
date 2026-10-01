/**
 * Role + admin-allowlist helpers.
 *
 * These used to live in lib/firebase.ts (mirroring firestore.rules isAdmin()).
 * Firebase has been removed, so this is now the single source of truth for
 * admin detection until real authentication lands.
 */

/** Emails that receive the admin role on demo sign-in. */
export const ADMIN_EMAILS = [
  "aryaadmin@gmail.com", // original admin
  "admin@grievai.test", // dev admin (local testing only)
];

export function isAdminEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" && ADMIN_EMAILS.includes(email.trim().toLowerCase())
  );
}

/**
 * Demo role resolution: allowlisted admins, or any address containing "admin"
 * (so the dashboard is easy to preview locally).
 */
export function roleForEmail(email: string): "citizen" | "admin" {
  const normalized = email.trim().toLowerCase();
  return isAdminEmail(normalized) || normalized.includes("admin")
    ? "admin"
    : "citizen";
}
