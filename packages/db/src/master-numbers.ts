import type { PrismaClient } from "@prisma/client";
import type { Tx } from "./index";

type Db = PrismaClient | Tx;

async function nextFromSequence(db: Db, sequence: "customer_number_seq" | "supplier_number_seq") {
  const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT nextval('${sequence}') AS n`);
  return Number(rows[0]!.n);
}

/** Kundennummer K-000001 (Lücken erlaubt) */
export async function nextCustomerNumber(db: Db): Promise<string> {
  return `K-${String(await nextFromSequence(db, "customer_number_seq")).padStart(6, "0")}`;
}

/** Lieferantennummer L-000001 (Lücken erlaubt) */
export async function nextSupplierNumber(db: Db): Promise<string> {
  return `L-${String(await nextFromSequence(db, "supplier_number_seq")).padStart(6, "0")}`;
}
