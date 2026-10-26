import { PrismaClient } from "@prisma/client";

/** Rate-Limit-Zähler leeren, damit wiederholte Testläufe nicht an OTP-Limits scheitern (nur Testumgebung!). */
export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    await db.rateLimitBucket.deleteMany({});
  } finally {
    await db.$disconnect();
  }
}
