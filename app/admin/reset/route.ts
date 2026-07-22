import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-auth");

/**
 * Verifies the token from a Supabase password-reset (or magic-link) email and
 * establishes a session, then forwards the admin into the app. This is the
 * server-side landing for the link in the email — it reads `token_hash` and
 * `type` from the query string (NOT the URL hash), so the Supabase email
 * template must point here:
 *
 *   {{ .SiteURL }}/admin/reset?token_hash={{ .TokenHash }}&type=recovery
 *
 * On a `recovery` link we send the admin to /admin/update-password to choose a
 * new password; any other valid type lands on the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const fail = (reason: string) => {
    log.warn(`Reset link rejected: ${reason}`);
    return NextResponse.redirect(
      `${origin}/admin/forgot-password?error=expired`,
    );
  };

  if (!tokenHash || !type) {
    return fail("missing token_hash or type");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return fail(error.message);
  }

  // Recovery/magic-link works for anyone in Supabase Auth; restrict to admins.
  if (!isAdminEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return fail(`non-admin email: ${data.user?.email}`);
  }

  const dest = type === "recovery" ? "/admin/update-password" : "/admin";
  log.success(`Reset link verified for ${data.user?.email} → ${dest}`);
  return NextResponse.redirect(`${origin}${dest}`);
}
