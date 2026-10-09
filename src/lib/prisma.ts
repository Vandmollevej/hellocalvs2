import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { decryptResult, hasTopLevelEmail, transformArgs } from "./user-data-transform";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

function createClient() {
  const base = new PrismaClient({ adapter });
  // User.email og User.displayName er krypteret i databasen (AES-256-GCM,
  // docs/DECISIONS.md 2026-10-04). Opslag paa email gaar via User.emailHash.
  // Hele omskrivningen sker her, saa resten af koden uaendret ser klartekst.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (operation.startsWith("$")) return query(args);
          const email = model === "User" && operation === "findUnique" ? hasTopLevelEmail(args) : null;
          const result = await query(transformArgs(model, operation, args) as typeof args);
          if (result === null && email !== null) {
            // Raekker der endnu ikke er backfillet har ingen emailHash: proev klartekst-opslag.
            const legacy = await (base.user as unknown as { findUnique: (a: unknown) => Promise<unknown> }).findUnique(
              transformArgs(model, operation, args, true),
            );
            return decryptResult(model, legacy);
          }
          if (operation === "count" || operation === "aggregate" || operation === "groupBy") return result;
          return decryptResult(model, result);
        },
      },
    },
  });
}

// Extension aendrer ingen typer, saa klienten types som PrismaClient (holder
// Prisma.TransactionClient-parametre i resten af koden gyldige).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? (createClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
