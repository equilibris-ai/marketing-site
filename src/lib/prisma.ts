import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("prisma");

// Resolve the connection string from this project's names first, then the names
// the Vercel + Supabase integration injects automatically (POSTGRES_PRISMA_URL
// is the pooled connection it creates for Prisma).
const connectionString =
  process.env.DATABASE_DSN ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;

if (!connectionString) {
  // Without this, node-postgres silently defaults to 127.0.0.1:5432 — the cause
  // of the baffling "Can't reach database server at 127.0.0.1:5432" in prod.
  throw new Error(
    "No database connection string found. Set DATABASE_DSN (or POSTGRES_PRISMA_URL) to the Supabase pooler URL.",
  );
}

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
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads / serverless invocations.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
