/**
 * Notfall: Inhaber-Zugang setzen bzw. zurücksetzen (Benutzername + Passwort, Rolle „owner“, aktiv).
 * Aufruf über scripts/admin-reset.sh (übergibt RESET_USERNAME / RESET_PASSWORD / optional RESET_PHONE).
 */
import { hash } from "@node-rs/argon2";
import { normalizePhone } from "@sa/core";
import { PrismaClient } from "@prisma/client";

const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const prisma = new PrismaClient();

async function main() {
  const username = (process.env.RESET_USERNAME ?? "admin").trim().toLowerCase();
  const rawPhone = process.env.RESET_PHONE?.trim();
  const password = process.env.RESET_PASSWORD ?? "";
  const name = process.env.RESET_NAME?.trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error("Benutzername: 3–32 Zeichen, a–z, 0–9, . _ -");
  if (password.length < 10) throw new Error("Passwort zu kurz (mindestens 10 Zeichen).");
  const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "owner" } });
  const passwordHash = await hash(password, ARGON);

  // Konto mit diesem Benutzernamen – sonst das älteste Inhaber-Konto – sonst neu anlegen
  const byUsername = await prisma.user.findUnique({ where: { username } });
  if (byUsername && byUsername.kind !== "STAFF") throw new Error("Benutzername gehört zu keinem Mitarbeiterkonto.");
  const owner = byUsername ?? (await prisma.user.findFirst({ where: { kind: "STAFF", roles: { some: { role: { key: "owner" } } } }, orderBy: { createdAt: "asc" } }));
  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone } });
    if (byPhone && byPhone.id !== owner?.id) throw new Error(`${phone} gehört schon zu einem anderen Konto.`);
  }
  if (!owner && !phone) throw new Error("Noch kein Inhaber vorhanden – bitte zusätzlich eine Handynummer angeben.");

  const user = owner
    ? await prisma.user.update({ where: { id: owner.id }, data: { username, passwordHash, isActive: true, ...(phone ? { phone, phoneVerifiedAt: new Date() } : {}), ...(name ? { name } : {}) } })
    : await prisma.user.create({ data: { kind: "STAFF", username, phone: phone!, phoneVerifiedAt: new Date(), name: name || "المالك", passwordHash } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  // Sperren durch Fehlversuche aufheben, alte Sitzungen beenden
  await prisma.rateLimitBucket.deleteMany({});
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`✓ Admin-Zugang gesetzt – Benutzername: ${user.username} (${user.name})`);
}

main()
  .catch((e: unknown) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
