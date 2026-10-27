import "server-only";
import { prisma, type DocType, type OrderStatus, type PrintTrigger } from "@sa/db";
import { mergePdfs, type DocLang } from "@sa/pdf";
import { storeFile } from "../adapters/storage";
import type { AuthContext } from "../auth/context";
import { DOC_TYPE_SLUG, orderDocumentRefs, renderStoredDocument } from "./documents";

/**
 * Druckaufträge: automatisch bei Statuswechsel (AutoPrintRule, z. B. „Bestätigt“ → Kommissionierliste,
 * „Unterwegs“ → Lieferschein) oder manuell. Der Hintergrund-Worker rendert die PDFs und legt sie ab;
 * im Admin unter „Druckaufträge“ abrufbar (Druckerstation öffnet und druckt sie).
 */

interface JobOptions {
  lang?: DocLang;
  withPrices?: boolean;
}

const ORDER_DOC: Partial<Record<DocType, string>> = {
  ORDER_CONFIRMATION: "order-confirmation",
  PICK_LIST: "pick-list",
  DELIVERY_NOTE: "delivery-note",
  INVOICE: "invoice",
};

export async function queueAutoPrint(orderId: string, status: OrderStatus, ctx: AuthContext | null): Promise<number> {
  const rules = await prisma.autoPrintRule.findMany({ where: { onStatus: status, enabled: true } });
  for (const r of rules) {
    await prisma.printJob.create({
      data: {
        trigger: "AUTO_STATUS",
        docTypes: [r.docType],
        entityType: "Order",
        entityIds: [orderId],
        options: { lang: r.language === "EN" ? "en" : r.language === "BILINGUAL" ? "bi" : "ar", withPrices: r.withPrices },
        createdById: ctx?.user.id ?? null,
      },
    });
  }
  if (rules.length) void processPrintJobs().catch((err: unknown) => console.error("[print-jobs]", err));
  return rules.length;
}

export async function queuePrintJob(ctx: AuthContext, input: { trigger: PrintTrigger; docTypes: DocType[]; entityType: string; entityIds: string[]; options?: JobOptions }) {
  const job = await prisma.printJob.create({ data: { ...input, options: (input.options ?? {}) as object, createdById: ctx.user.id } });
  void processPrintJobs().catch((err: unknown) => console.error("[print-jobs]", err));
  return job;
}

let current: Promise<number> | null = null;

/** Worker: offene Aufträge rendern (sequenziell, ein Chromium). Läuft schon einer, wird dieser zurückgegeben. */
export function processPrintJobs(limit = 10): Promise<number> {
  current ??= runPrintJobs(limit).finally(() => {
    current = null;
  });
  return current;
}

async function runPrintJobs(limit: number): Promise<number> {
  let done = 0;
  {
    for (let i = 0; i < limit; i++) {
      // Auftrag atomar übernehmen
      const claimed = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "PrintJob" SET "status" = 'RENDERING'
        WHERE id = (SELECT id FROM "PrintJob" WHERE "status" = 'QUEUED' ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id`;
      const id = claimed[0]?.id;
      if (!id) break;
      const job = await prisma.printJob.findUniqueOrThrow({ where: { id } });
      try {
        const opts = (job.options ?? {}) as JobOptions;
        const files: Buffer[] = [];
        if (job.entityType === "Order") {
          const docs = job.docTypes.map((d) => (d === "DELIVERY_NOTE" && opts.withPrices === false ? "delivery-note-np" : ORDER_DOC[d])).filter((d): d is string => !!d);
          for (const ref of await orderDocumentRefs(job.entityIds, docs)) files.push(await renderStoredDocument(ref.slug, ref.id, opts.lang ?? null, { ...ref.opts }));
        } else {
          for (const d of job.docTypes) {
            const slug = DOC_TYPE_SLUG[d];
            if (!slug) continue;
            for (const eid of job.entityIds) files.push(await renderStoredDocument(slug, eid, opts.lang ?? null, { withPrices: opts.withPrices }));
          }
        }
        if (files.length === 0) throw new Error("no documents");
        const pdf = await mergePdfs(files);
        const file = await storeFile({ data: pdf, mimeType: "application/pdf", originalName: `print-${job.id}.pdf`, purpose: "print-job", uploadedById: job.createdById });
        await prisma.printJob.update({ where: { id }, data: { status: "DONE", fileId: file.id, finishedAt: new Date(), error: null } });
        done++;
      } catch (err) {
        await prisma.printJob.update({ where: { id }, data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : String(err), finishedAt: new Date() } });
      }
    }
  }
  return done;
}

export async function listPrintJobs(page = 1) {
  const take = 50;
  const [items, total] = await Promise.all([
    prisma.printJob.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.printJob.count(),
  ]);
  const orderIds = [...new Set(items.filter((j) => j.entityType === "Order").flatMap((j) => j.entityIds))];
  const orders = new Map((await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })).map((o) => [o.id, o.number]));
  return { items: items.map((j) => ({ ...j, labels: j.entityIds.map((e) => orders.get(e) ?? e) })), total, pageSize: take };
}

export async function retryPrintJob(id: string) {
  await prisma.printJob.update({ where: { id }, data: { status: "QUEUED", error: null, finishedAt: null } });
  void processPrintJobs().catch((err: unknown) => console.error("[print-jobs]", err));
}
