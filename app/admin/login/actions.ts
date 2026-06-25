"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-auth");

export type SignInState = { error?: string };

/**
 * Email + password sign-in for the admin. Checks the ADMIN_EMAILS allowlist
 * before touching Supabase so non-admins get a generic rejection. On success,
 * Supabase sets the session cookie and we redirect into the dashboard.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isAdminEmail(email)) {
    log.warn(`Rejected admin login for non-allowlisted email: ${email}`);
    return { error: "Invalid email or password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    log.warn(`Admin login failed for ${email}: ${error.message}`);
    return { error: "Invalid email or password." };
  }

  log.success(`Admin signed in: ${email}`);
  redirect("/admin");
}
