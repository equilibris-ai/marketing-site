import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("prisma");

// Resolve the connection string from this project's names first, then the names
// the Vercel + Supabase integration injects automatically (POSTGRES_PRISMA_URL
// is the pooled connection it creates for Prisma).
const resolvedDsn =
  process.env.DATABASE_DSN ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;

if (!resolvedDsn) {
  // Without this, node-postgres silently defaults to 127.0.0.1:5432 — the cause
  // of the baffling "Can't reach database server at 127.0.0.1:5432" in prod.
  throw new Error(
    "No database connection string found. Set DATABASE_DSN (or POSTGRES_PRISMA_URL) to the Supabase pooler URL.",
  );
}

// Typed as string so the not-undefined narrowing survives into createClient().
const connectionString: string = resolvedDsn;

// Log only the host (never credentials) so deploy logs confirm which DB we hit.
try {
  log.info(`Prisma target: ${new URL(connectionString).host}`);
} catch {
  log.error(
    "Connection string is set but is not a valid URL — check for stray quotes around the value.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  // Strip any `sslmode` param so we control TLS in code rather than via the
  // string (pg now treats `require` as strict `verify-full`, which rejects the
  // pooler cert with "self-signed certificate in certificate chain").
  let url = connectionString;
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete("sslmode");
    url = parsed.toString();
  } catch {
    // Not a parseable URL — use it as-is and let pg surface any error.
  }

  // TLS policy for the Supabase pooler (its cert is signed by Supabase's own CA,
  // not the system trust store). Secure by default; never silently unverified:
  //   - SUPABASE_CA_CERT set -> verify against that CA (preferred, no MITM gap).
  //   - DB_TLS_INSECURE=true  -> encrypt but skip verification (explicit opt-in).
  //   - neither               -> verify against the system trust store; this
  //                              FAILS CLOSED on the pooler rather than trusting
  //                              an unverified cert.
  const ca = process.env.SUPABASE_CA_CERT;
  let ssl: { ca?: string; rejectUnauthorized: boolean };
  if (ca) {
    ssl = { ca, rejectUnauthorized: true };
  } else if (process.env.DB_TLS_INSECURE === "true") {
    log.warn(
      "DB_TLS_INSECURE=true — database TLS is encrypted but the certificate is NOT verified (MITM risk). " +
        "Set SUPABASE_CA_CERT (Supabase → Project Settings → Database → SSL) to remove this.",
    );
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = { rejectUnauthorized: true };
  }

  const adapter = new PrismaPg({ connectionString: url, ssl });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads / serverless invocations.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
