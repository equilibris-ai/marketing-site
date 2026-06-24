import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/verification";
import { createLogger } from "@/lib/logger";
import { annotate, withSpan } from "@/lib/tracing";

const log = createLogger("verify");

/** Redirect back to the homepage with a status the UI can surface. */
function redirectHome(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/?verify=${status}`, request.url));
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("token");
  if (!raw) {
    log.warn("Verification attempt with no token");
    return redirectHome(request, "invalid");
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(raw) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    const reason = !record ? "unknown token" : record.usedAt ? "token already used" : "token expired";
    annotate({ "app.verify.result": "invalid", "app.verify.reason": reason });
    log.warn(`Verification rejected — ${reason}`);
    return redirectHome(request, "invalid");
  }

  // Mark the lead verified and burn the token in one transaction.
  await withSpan(
    "db.verify.transaction",
    { "db.system": "postgresql", "db.operation": "transaction", "app.lead.id": record.leadId },
    () =>
      prisma.$transaction([
        prisma.lead.update({
          where: { id: record.leadId },
          data: { verifiedAt: new Date() },
        }),
        prisma.verificationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
      ]),
  );

  annotate({ "app.verify.result": "success", "app.lead.id": record.leadId });
  log.success(`Email verified for lead ${record.leadId}`);
  return redirectHome(request, "success");
}
