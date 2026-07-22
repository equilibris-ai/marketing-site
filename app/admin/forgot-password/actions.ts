"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { baseUrl } from "@/lib/verification";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-auth");

export type ForgotState = { error?: string; sent?: boolean };

/**
 * Send a password-reset email to an admin. Only allowlisted admin emails are
 * accepted; password reset is an admin-only flow (leads never authenticate).
 *
 * Always reports success to the caller — never reveal whether an email exists.
 * The reset link lands on `/admin/reset`, which verifies the token server-side.
 */
export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  // Non-admins get the same "sent" response so we don't leak the allowlist.
  if (!isAdminEmail(email)) {
    log.warn(`Password-reset requested for non-allowlisted email: ${email}`);
    return { sent: true };
  }

  const base = baseUrl();
  const origin = base.startsWith("http") ? base : `https://${base}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/admin/reset`,
  });

  if (error) {
    log.error(`resetPasswordForEmail failed for ${email}: ${error.message}`);
    return { error: "Could not send the reset email. Please try again." };
  }

  log.success(`Password-reset email sent to ${email}`);
  return { sent: true };
}
