"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-auth");

export type UpdatePasswordState = { error?: string };

const MIN_LENGTH = 10;

/**
 * Set a new password for the currently-authenticated admin. Reached after the
 * recovery link in /admin/reset establishes a session. Re-checks the session
 * and the admin allowlist before writing — never trusts the page alone.
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { error: `Use at least ${MIN_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    // Recovery session missing/expired, or a non-admin slipped through.
    redirect("/admin/forgot-password?error=expired");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    log.error(`updateUser(password) failed for ${user.email}: ${error.message}`);
    return { error: "Could not update the password. The link may have expired." };
  }

  log.success(`Password updated for ${user.email}`);
  redirect("/admin");
}
