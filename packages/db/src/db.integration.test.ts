import { findSequenceGaps } from "@sa/core";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { allocateDocumentNumber } from "./numbering";
import { nextCustomerNumber } from "./master-numbers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database integration", () => {
  const db = new PrismaClient({ datasourceUrl: url });

  beforeEach(async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL sa.allow_purge = 'on'`);
      await tx.$executeRawUnsafe(
        `TRUNCATE "NumberSequence", "InvoiceLine", "Invoice", "AuditLog", "Customer" RESTART IDENTITY CASCADE`,
      );
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("allocateDocumentNumber", () => {
    it("starts at 1 and counts up per doc type and year", async () => {
      const at = new Date("2026-05-01T10:00:00Z");
      const a = await db.$transaction((tx) => allocateDocumentNumber(tx, "INVOICE", at));
      const b = await db.$transaction((tx) => allocateDocumentNumber(tx, "INVOICE", at));
      const c = await db.$transaction((tx) => allocateDocumentNumber(tx, "DELIVERY_NOTE", at));
      expect([a.number, b.number, c.number]).toEqual(["INV-2026-000001", "INV-2026-000002", "DN-2026-000001"]);
      const seq = await db.numberSequence.findUnique({ where: { docType_year: { docType: "INVOICE", year: 2026 } } });
      expect(seq?.gapless).toBe(true);
    });

    it("restarts every business year (Asia/Hebron) and keeps a customised prefix", async () => {
      await db.$transaction((tx) => allocateDocumentNumber(tx, "QUOTE", new Date("2026-12-31T12:00:00Z")));
      await db.numberSequence.update({
        where: { docType_year: { docType: "QUOTE", year: 2026 } },
        data: { prefix: "OFR", padding: 5 },
      });
      // 31.12. 23:30 UTC ist in Hebron bereits 2027
      const next = await db.$transaction((tx) => allocateDocumentNumber(tx, "QUOTE", new Date("2026-12-31T23:30:00Z")));
      expect(next.number).toBe("OFR-2027-00001");
    });

    it("does not consume a number when the transaction rolls back (gapless)", async () => {
      const at = new Date("2026-05-01T10:00:00Z");
      await db.$transaction((tx) => allocateDocumentNumber(tx, "INVOICE", at));
      await expect(
        db.$transaction(async (tx) => {
          await allocateDocumentNumber(tx, "INVOICE", at);
          throw new Error("invoice insert failed");
        }),
      ).rejects.toThrow("invoice insert failed");
      const next = await db.$transaction((tx) => allocateDocumentNumber(tx, "INVOICE", at));
      expect(next.seq).toBe(2);
    });

    it("hands out unique, gapless numbers under concurrency", async () => {
      const at = new Date("2026-05-01T10:00:00Z");
      const N = 25;
      const results = await Promise.allSettled(
        Array.from({ length: N }, (_, i) =>
          db.$transaction(
            async (tx) => {
              const n = await allocateDocumentNumber(tx, "INVOICE", at);
              // jede 5. Transaktion schlägt nach der Vergabe fehl
              if (i % 5 === 4) throw new Error("boom");
              return n.seq;
            },
            { timeout: 20_000, maxWait: 20_000 },
          ),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<number>).value);
      expect(ok).toHaveLength(N - N / 5);
      expect(findSequenceGaps(ok)).toEqual({ missing: [], duplicates: [] });
      expect(Math.max(...ok)).toBe(ok.length);
    });
  });

  describe("immutability triggers", () => {
    async function createInvoice() {
      const customer = await db.customer.create({
        data: { number: await nextCustomerNumber(db), type: "B2C", displayName: "Test" },
      });
      return db.invoice.create({
        data: {
          number: "INV-2026-000001",
          customerId: customer.id,
          channel: "B2C",
          issueDate: new Date("2026-05-01"),
          dueDate: new Date("2026-05-01"),
          sellerSnapshot: {},
          customerSnapshot: {},
          subtotalNet: 1000,
          vatTotal: 160,
          totalGross: 1160,
          paymentMethod: "CASH_ON_DELIVERY",
          lines: {
            create: {
              sku: "X",
              nameAr: "س",
              nameEn: "X",
              unitCode: "PIECE",
              unitFactor: 1,
              qty: 1,
              qtyBase: 1,
              unitPriceNet: 1000,
              vatRateBps: 1600,
              lineNet: 1000,
              lineVat: 160,
              lineGross: 1160,
            },
          },
        },
        include: { lines: true },
      });
    }

    it("allows payment status updates but blocks changes to amounts", async () => {
      const inv = await createInvoice();
      await db.invoice.update({ where: { id: inv.id }, data: { paidAmount: 1160, status: "PAID" } });
      await expect(db.invoice.update({ where: { id: inv.id }, data: { totalGross: 1 } })).rejects.toThrow();
      await expect(db.invoice.update({ where: { id: inv.id }, data: { subtotalNet: 1, vatTotal: 0, totalGross: 1 } })).rejects.toThrow(/immutable/);
    });

    it("blocks deleting invoices and changing lines", async () => {
      const inv = await createInvoice();
      await expect(db.invoice.delete({ where: { id: inv.id } })).rejects.toThrow(/credit note/);
      await expect(
        db.invoiceLine.update({ where: { id: inv.lines[0]!.id }, data: { qty: 2, qtyBase: 2 } }),
      ).rejects.toThrow(/append-only/);
    });

    it("keeps the audit log append-only", async () => {
      const log = await db.auditLog.create({ data: { action: "test", entityType: "Test" } });
      await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "x" } })).rejects.toThrow(/append-only/);
      await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
    });

    it("enforces check constraints", async () => {
      const customer = await db.customer.create({
        data: { number: await nextCustomerNumber(db), type: "B2C", displayName: "Test" },
      });
      await expect(
        db.customer.update({ where: { id: customer.id }, data: { creditLimitAgorot: -1 } }),
      ).rejects.toThrow();
      await expect(
        db.customer.create({ data: { number: "K-X", type: "B2B", displayName: "Firma ohne Händlernummer" } }),
      ).rejects.toThrow();
    });
  });
});
