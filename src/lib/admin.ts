/**
 * Admin authorization helpers. Kept free of `next/headers` / server-only
 * imports so this module is safe to pull into the Proxy runtime.
 *
 * Authentication (is this a real, logged-in Supabase user?) is handled by
 * Supabase Auth. Authorization (is this user allowed in the admin?) is this
 * allowlist: only addresses in ADMIN_EMAILS may see the dashboard, so a random
 * Supabase signup can never reach the lead list.
 */

/** Parse the comma-separated ADMIN_EMAILS allowlist into lowercased entries. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
