import { prisma } from "@sa/db";
import { hasPermission } from "@sa/core";
import { readFile } from "@/server/adapters/storage";
import { getAuth } from "@/server/auth/context";
import { forbidden, notFound, unauthorized } from "@/server/errors";
import { apiRoute } from "@/server/http";

/**
 * Dateien werden nie öffentlich ausgeliefert, sondern nur über diesen Endpunkt
 * mit Rechteprüfung gestreamt (Gewerbelizenz: Mitarbeiter mit customer.view oder die eigene Firma).
 */
export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const file = await prisma.fileObject.findUnique({
    where: { id },
    include: {
      customerLicenses: { select: { id: true } },
      customerFiles: { select: { customerId: true } },
      signatures: { select: { order: { select: { customerId: true } } } },
      photos: { select: { order: { select: { customerId: true } } } },
    },
  });
  if (!file) throw notFound();
  const customerIds = new Set([...file.customerLicenses.map((c) => c.id), ...file.customerFiles.map((c) => c.customerId)]);
  // Zustellnachweis (Unterschrift/Foto): Mitarbeiter mit Bestellrecht und der Kunde der Bestellung
  const proofOf = new Set([...file.signatures, ...file.photos].map((s) => s.order.customerId));
  const allowed =
    (ctx.isStaff && customerIds.size > 0 && hasPermission(ctx.permissions, "customer.view")) ||
    (ctx.isStaff && hasPermission(ctx.permissions, "settings.view") && file.purpose === "company-logo") ||
    (!!ctx.customer && customerIds.has(ctx.customer.id)) ||
    (proofOf.size > 0 && ctx.isStaff && hasPermission(ctx.permissions, "order.view")) ||
    (!!ctx.customer && proofOf.has(ctx.customer.id));
  if (!allowed) throw forbidden();
  const obj = await readFile(file.bucket, file.key);
  return new Response(obj.stream as ReadableStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName ?? file.id)}"`,
      "X-Content-Type-Options": "nosniff",
      // SVG-Unterschriften dürfen nie Skripte ausführen
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
});
