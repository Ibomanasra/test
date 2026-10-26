import { PrismaClient } from "@prisma/client";

// Explizite Re-Exporte (Turbopack kann `export *` aus CJS nicht statisch auflösen)
export { Prisma, PrismaClient } from "@prisma/client";
export type * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __saPrisma?: PrismaClient };

/** Ein PrismaClient pro Prozess (verhindert Verbindungsflut bei Next.js-Hot-Reload). */
export const prisma: PrismaClient =
  globalForPrisma.__saPrisma ??
  new PrismaClient({ log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.__saPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export { allocateDocumentNumber, type AllocatedNumber } from "./numbering";
export { nextCustomerNumber, nextSupplierNumber } from "./master-numbers";
