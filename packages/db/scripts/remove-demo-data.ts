/**
 * Entfernt alle als Demo markierten Daten (isDemo = true bzw. Demo-Mitarbeiter „(مثال)“).
 * Läuft in EINER Transaktion mit SET LOCAL sa.allow_purge = 'on' (Wartungsmodus der Schutz-Trigger).
 *
 *   pnpm --filter @sa/db remove-demo -- --yes
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Abbruch: zur Bestätigung --yes angeben.");
    process.exitCode = 1;
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL sa.allow_purge = 'on'`);
    const customers = await tx.customer.findMany({ where: { isDemo: true }, select: { id: true, members: { select: { userId: true } } } });
    const customerIds = customers.map((c) => c.id);
    const userIds = customers.flatMap((c) => c.members.map((m) => m.userId));
    // Abhängige Belege zuerst (ab Phase 3 vorhanden)
    await tx.order.deleteMany({ where: { OR: [{ isDemo: true }, { customerId: { in: customerIds } }] } });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    await tx.product.deleteMany({ where: { isDemo: true } });
    await tx.supplier.deleteMany({ where: { isDemo: true } });
    const demoStaff = await tx.user.findMany({ where: { kind: "STAFF", name: { contains: "(مثال)" } }, select: { id: true } });
    const allUsers = [...userIds, ...demoStaff.map((u) => u.id)];
    // Audit-Einträge bleiben erhalten; actorId wird per FK auf NULL gesetzt (im Wartungsmodus erlaubt)
    await tx.user.deleteMany({ where: { id: { in: allUsers } } });
    console.info(`removed ${customerIds.length} demo customers, ${demoStaff.length} demo staff`);
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
