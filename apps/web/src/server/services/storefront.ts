import "server-only";
import type { storefrontTextSchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import type { z } from "zod";
import { sniffMimeType, storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { badRequest } from "../errors";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Daten für den Kopf der Startseite: Texte, eigenes Bild oder Produktfotos, Anzahl Produkte */
export async function getStorefront() {
  const [s, productCount, photos] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { heroTitleAr: true, heroTitleEn: true, heroTextAr: true, heroTextEn: true, heroImageFileId: true } }),
    prisma.product.count({ where: { active: true } }),
    // Produktfotos für die Collage: aktive Produkte, zuerst die mit Bild
    prisma.productImage.findMany({ where: { product: { active: true } }, distinct: ["productId"], orderBy: [{ productId: "asc" }, { sortOrder: "asc" }], take: 6, select: { fileId: true } }),
  ]);
  return {
    titleAr: s?.heroTitleAr ?? null,
    titleEn: s?.heroTitleEn ?? null,
    textAr: s?.heroTextAr ?? null,
    textEn: s?.heroTextEn ?? null,
    imageFileId: s?.heroImageFileId ?? null,
    productCount,
    photoIds: photos.map((p) => p.fileId),
  };
}

export async function updateStorefrontText(ctx: AuthContext, input: z.infer<typeof storefrontTextSchema>) {
  const before = await prisma.companySettings.findUniqueOrThrow({ where: { id: 1 }, select: { heroTitleAr: true, heroTitleEn: true, heroTextAr: true, heroTextEn: true } });
  await prisma.companySettings.update({ where: { id: 1 }, data: input });
  await audit(ctx, { action: "settings.storefront", entityType: "CompanySettings", entityId: "1", before, after: input });
  return input;
}

export async function setHeroImage(ctx: AuthContext, file: File | null) {
  if (!file) {
    await prisma.companySettings.update({ where: { id: 1 }, data: { heroImageFileId: null } });
    await audit(ctx, { action: "settings.storefront.image.remove", entityType: "CompanySettings", entityId: "1" });
    return { heroImageFileId: null };
  }
  if (file.size > 8 * 1024 * 1024) throw badRequest("file_too_large");
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffMimeType(data);
  if (!mime || !IMAGE_TYPES.has(mime)) throw badRequest("invalid_file_type");
  const stored = await storeFile({ data, mimeType: mime, originalName: file.name, purpose: "storefront-image", uploadedById: ctx.user.id });
  await prisma.companySettings.update({ where: { id: 1 }, data: { heroImageFileId: stored.id } });
  await audit(ctx, { action: "settings.storefront.image", entityType: "CompanySettings", entityId: "1", after: { fileId: stored.id } });
  return { heroImageFileId: stored.id };
}
