import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { withSpan } from "@/lib/tracing";

/**
 * Issue a fresh double-opt-in verification token for a lead and email the
 * confirmation link. Shared by the public waitlist route and the admin
 * "resend confirmation" action so both paths behave identically.
 *
 * Returns the token's expiry so callers can log it.
 */
export async function issueAndSendVerification(lead: {
  id: string;
  email: string;
  name: string | null;
}): Promise<Date> {
  const { raw, hash, expiresAt } = createVerificationToken();

  await withSpan(
    "db.token.create",
    { "db.system": "postgresql", "db.operation": "insert", "db.sql.table": "verification_tokens" },
    () => prisma.verificationToken.create({ data: { token: hash, leadId: lead.id, expiresAt } }),
  );

  await sendVerificationEmail({ to: lead.email, name: lead.name, rawToken: raw });

  return expiresAt;
}
