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
    include: { customerLicenses: { select: { id: true } }, customerFiles: { select: { customerId: true } } },
  });
  if (!file) throw notFound();
  const customerIds = new Set([...file.customerLicenses.map((c) => c.id), ...file.customerFiles.map((c) => c.customerId)]);
  const allowed =
    (ctx.isStaff && customerIds.size > 0 && hasPermission(ctx.permissions, "customer.view")) ||
    (ctx.isStaff && hasPermission(ctx.permissions, "settings.view") && file.purpose === "company-logo") ||
    (!!ctx.customer && customerIds.has(ctx.customer.id));
  if (!allowed) throw forbidden();
  const obj = await readFile(file.bucket, file.key);
  return new Response(obj.stream as ReadableStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName ?? file.id)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
