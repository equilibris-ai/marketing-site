import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueAndSendVerification } from "@/lib/waitlist";
import { createLogger } from "@/lib/logger";
import { annotate, withSpan } from "@/lib/tracing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const log = createLogger("waitlist");

export async function POST(request: Request) {
  let body: { email?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  // Record business context on the request span (sliceable in Honeycomb).
  annotate({ "app.lead.email_domain": email.split("@")[1] ?? "" });

  if (!EMAIL_RE.test(email)) {
    annotate({ "app.outcome": "invalid_email" });
    log.warn(`Rejected waitlist submission — invalid email: ${JSON.stringify(body.email)}`);
    return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  }

  // Was this address already on the list? (createdAt/updatedAt can't tell us —
  // createdAt is a DB-clock default, updatedAt an app-clock value, so they're
  // never exactly equal even on insert.) Cheap existence check before upsert.
  const existed = await prisma.lead.findUnique({ where: { email }, select: { id: true } });

  // Upsert the lead so re-submits don't error and can re-trigger verification.
  const lead = await withSpan(
    "db.lead.upsert",
    { "db.system": "postgresql", "db.operation": "upsert", "db.sql.table": "leads" },
    () =>
      prisma.lead.upsert({
        where: { email },
        create: { email, name },
        update: name ? { name } : {},
      }),
  );

  const isNew = !existed;
  annotate({
    "app.lead.id": lead.id,
    "app.lead.is_new": isNew,
    "app.lead.already_verified": Boolean(lead.verifiedAt),
  });
  log.info(
    `${isNew ? "New lead created" : "Returning lead"}: ${lead.email}${
      lead.name ? ` (${lead.name})` : ""
    }`,
  );

  // Already confirmed — nothing more to do.
  if (lead.verifiedAt) {
    annotate({ "app.outcome": "already_verified" });
    log.info(`Lead already verified, skipping email: ${lead.email}`);
    return NextResponse.json({ status: "already_verified" }, { status: 200 });
  }

  const expiresAt = await issueAndSendVerification(lead);
  log.info(`Verification token issued for ${lead.email} (expires ${expiresAt.toISOString()})`);

  annotate({ "app.outcome": "verification_sent" });
  return NextResponse.json({ status: "verification_sent" }, { status: 201 });
}
