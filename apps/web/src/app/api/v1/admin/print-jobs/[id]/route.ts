import { prisma } from "@sa/db";
import { readFileBuffer } from "@/server/adapters/storage";
import { requireStaff } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { pdfResponse } from "@/server/pdf-response";
import { retryPrintJob } from "@/server/services/print-jobs";

/** PDF eines fertigen Druckauftrags */
export const GET = apiRoute<{ id: string }>(async (req, { params }) => {
  await requireStaff("order.print");
  const { id } = await params;
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job?.fileId) throw notFound();
  const f = await readFileBuffer(job.fileId);
  return pdfResponse(f.data, `print-${id}.pdf`, req.nextUrl.searchParams.get("download") === "1");
});

/** Fehlgeschlagenen Auftrag erneut einreihen */
export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("order.print");
  const { id } = await params;
  await retryPrintJob(id);
  return { ok: true };
});
