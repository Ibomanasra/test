import { htmlToPdf, renderLabelSheetHtml } from "@sa/pdf";
import { prisma } from "@sa/db";
import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { pdfResponse } from "@/server/pdf-response";
import { priceItems, priceKey } from "@/server/services/pricing";

/**
 * Barcode-Etiketten (A4, 3 × 8): ?skus=CL-001,CL-002&copies=2&price=1
 * Ohne skus: alle aktiven Varianten. Preis = B2C-Brutto (Regalpreis).
 */
export const GET = apiRoute(async (req) => {
  await requireStaff("product.print_labels");
  const q = req.nextUrl.searchParams;
  const skus = (q.get("skus") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const copies = Math.min(50, Math.max(1, Number(q.get("copies") ?? 1) || 1));
  const variants = await prisma.productVariant.findMany({
    where: { active: true, ...(skus.length ? { sku: { in: skus } } : {}) },
    select: { id: true, sku: true, barcode: true, nameAr: true, nameEn: true, product: { select: { nameAr: true, nameEn: true } } },
    orderBy: { sku: "asc" },
    take: 2000,
  });
  const prices = q.get("price") === "1" ? await priceItems(variants.map((v) => ({ variantId: v.id, qtyBase: 1 })), { channel: "B2C", customerId: null }) : null;
  const labels = variants.flatMap((v) =>
    Array.from({ length: copies }, () => ({
      code: v.barcode ?? v.sku,
      nameAr: [v.product.nameAr, v.nameAr].filter(Boolean).join(" – "),
      nameEn: [v.product.nameEn, v.nameEn].filter(Boolean).join(" – "),
      price: prices?.get(priceKey(v.id, 1))?.unitGross ?? null,
    })),
  );
  const pdf = await htmlToPdf(renderLabelSheetHtml(labels), { marginMm: 0 });
  return pdfResponse(pdf, "labels.pdf", q.get("download") === "1");
});
