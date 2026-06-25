"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { issueAndSendVerification } from "@/lib/waitlist";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin");

/** Sign the current admin out and return to the login page. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/** Re-issue a verification email for an unconfirmed lead. */
export async function resendConfirmation(formData: FormData) {
  await requireAdmin();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    log.warn(`resendConfirmation: lead not found (${leadId})`);
    return;
  }
  if (lead.verifiedAt) {
    log.info(`resendConfirmation: ${lead.email} already verified, skipping`);
    return;
  }

  await issueAndSendVerification(lead);
  log.success(`Re-sent confirmation to ${lead.email}`);
  revalidatePath("/admin");
}

/** Permanently delete a lead (verification tokens cascade). */
export async function deleteLead(formData: FormData) {
  await requireAdmin();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead
    .delete({ where: { id: leadId } })
    .catch((error: unknown) => {
      log.error(`deleteLead failed for ${leadId}: ${String(error)}`);
      return null;
    });

  if (lead) log.warn(`Deleted lead ${lead.email}`);
  revalidatePath("/admin");
}
