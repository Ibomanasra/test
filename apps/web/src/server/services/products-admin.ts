import "server-only";
import { hasPermission } from "@sa/core";
import { prisma, type Prisma, type Tx } from "@sa/db";
import { sniffMimeType, storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { env } from "../env";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";

export interface UnitInput {
  unitCode: string;
  factor: number;
  barcode?: string | null;
}

export interface ChannelRuleInput {
  channel: "B2C" | "B2B";
  defaultUnitCode: string;
  allowedUnitCodes: string[];
  minQtyBase: number;
  qtyStepBase: number;
}

export interface VariantInput {
  sku: string;
  barcode?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  costPrice?: number;
  b2cPrice?: number;
  b2bBasePrice?: number;
  minStock: number;
  defaultBinCode?: string | null;
  active: boolean;
  units: UnitInput[];
  rules: ChannelRuleInput[];
}

export interface ProductInput {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  categoryId: string;
  brand?: string | null;
  visibleB2C: boolean;
  visibleB2B: boolean;
  active: boolean;
}

export const PRODUCT_PAGE_SIZE = 25;

export async function listProducts(f: { q?: string; categoryId?: string; page: number; status?: "active" | "inactive" | "archived" }) {
  const where: Prisma.ProductWhereInput = {
    categoryId: f.categoryId,
    // Standard: archivierte ausblenden
    ...(f.status === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(f.status === "active" ? { active: true } : f.status === "inactive" ? { active: false } : {}),
    ...(f.q
      ? {
          OR: [
            { nameAr: { contains: f.q, mode: "insensitive" } },
            { nameEn: { contains: f.q, mode: "insensitive" } },
            { variants: { some: { OR: [{ sku: { contains: f.q, mode: "insensitive" } }, { barcode: { contains: f.q } }] } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { nameEn: "asc" },
      skip: (f.page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      include: {
        category: { select: { nameAr: true, nameEn: true } },
        variants: { select: { id: true, sku: true, barcode: true, active: true, minStock: true, b2cPrice: true, b2bBasePrice: true, stockLevels: { select: { onHand: true, reserved: true } } }, orderBy: { sortOrder: "asc" } },
        images: { select: { fileId: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { images: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total, pageSize: PRODUCT_PAGE_SIZE };
}

export async function getProductAdmin(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: {
        orderBy: { sortOrder: "asc" },
        include: {
          units: { include: { unit: true } },
          channelRules: true,
          defaultBin: true,
          stockLevels: true,
        },
      },
    },
  });
  if (!p) throw notFound();
  return p;
}

const EAN_RE = /^\d{8}$|^\d{12,14}$/;

export function isValidGtin(code: string): boolean {
  if (!EAN_RE.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

async function brandId(tx: Tx, name?: string | null) {
  if (!name?.trim()) return null;
  return (await tx.brand.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim() } })).id;
}

async function binId(tx: Tx, code?: string | null) {
  if (!code?.trim()) return null;
  const wh = await tx.warehouse.findFirstOrThrow({ where: { isDefault: true } });
  return (
    await tx.bin.upsert({
      where: { warehouseId_code: { warehouseId: wh.id, code: code.trim().toUpperCase() } },
      update: {},
      create: { warehouseId: wh.id, code: code.trim().toUpperCase(), sortKey: Number(code.replace(/\D/g, "")) || 0 },
    })
  ).id;
}

async function writeVariant(tx: Tx, ctx: AuthContext, productId: string, v: VariantInput, existingId?: string) {
  if (v.barcode && !isValidGtin(v.barcode)) throw badRequest("invalid_barcode", { sku: v.sku });
  for (const u of v.units) if (u.barcode && !isValidGtin(u.barcode)) throw badRequest("invalid_barcode", { sku: v.sku });
  if (!v.units.some((u) => u.unitCode === "PIECE" && u.factor === 1)) throw badRequest("piece_unit_required");
  const units = await tx.unitOfMeasure.findMany();
  const unitId = (code: string) => {
    const u = units.find((x) => x.code === code);
    if (!u) throw badRequest("invalid_unit");
    return u.id;
  };
  for (const r of v.rules) {
    if (!r.allowedUnitCodes.includes(r.defaultUnitCode)) throw badRequest("default_unit_not_allowed");
    if (r.allowedUnitCodes.some((c) => !v.units.some((u) => u.unitCode === c))) throw badRequest("invalid_unit");
  }
  const canPrice = hasPermission(ctx.permissions, "price.edit");
  const data = {
    sku: v.sku.trim(),
    barcode: v.barcode || null,
    nameAr: v.nameAr || null,
    nameEn: v.nameEn || null,
    minStock: v.minStock,
    active: v.active,
    defaultBinId: await binId(tx, v.defaultBinCode),
  };
  let variantId = existingId;
  if (existingId) {
    await tx.productVariant.update({ where: { id: existingId }, data });
  } else {
    // Preise beim Anlegen nur mit Preisrecht; sonst 0 (Produkt bleibt unsichtbar, bis bepreist)
    const created = await tx.productVariant.create({
      data: {
        ...data,
        productId,
        costPrice: canPrice && hasPermission(ctx.permissions, "price.view_cost") ? (v.costPrice ?? 0) : 0,
        b2cPrice: canPrice ? (v.b2cPrice ?? 0) : 0,
        b2bBasePrice: canPrice ? (v.b2bBasePrice ?? 0) : 0,
      },
    });
    variantId = created.id;
  }
  await tx.variantUnit.deleteMany({ where: { variantId } });
  await tx.variantUnit.createMany({ data: v.units.map((u) => ({ variantId: variantId!, unitId: unitId(u.unitCode), factor: u.factor, barcode: u.barcode || null })) });
  await tx.variantChannelRule.deleteMany({ where: { variantId } });
  await tx.variantChannelRule.createMany({
    data: v.rules.map((r) => ({
      variantId: variantId!,
      channel: r.channel,
      defaultUnitId: unitId(r.defaultUnitCode),
      allowedUnitIds: r.allowedUnitCodes.map(unitId),
      minQtyBase: r.minQtyBase,
      qtyStepBase: r.qtyStepBase,
    })),
  });
  return variantId!;
}

export async function createProduct(ctx: AuthContext, input: ProductInput, variant: VariantInput) {
  if (await prisma.product.findUnique({ where: { slug: input.slug } })) throw conflict("slug_exists");
  if (await prisma.productVariant.findUnique({ where: { sku: variant.sku } })) throw conflict("sku_exists");
  return prisma.$transaction(async (tx) => {
    const { brand, ...rest } = input;
    const priced = hasPermission(ctx.permissions, "price.edit") && (variant.b2cPrice ?? 0) > 0;
    const p = await tx.product.create({
      data: { ...rest, brandId: await brandId(tx, brand), visibleB2C: rest.visibleB2C && priced, visibleB2B: rest.visibleB2B && (hasPermission(ctx.permissions, "price.edit") && (variant.b2bBasePrice ?? 0) > 0) },
    });
    const variantId = await writeVariant(tx, ctx, p.id, variant);
    await audit(ctx, { action: "product.create", entityType: "Product", entityId: p.id, after: { ...input, sku: variant.sku, variantId } }, tx);
    return p;
  });
}

export async function updateProduct(ctx: AuthContext, id: string, input: ProductInput) {
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw notFound();
  const clash = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (clash && clash.id !== id) throw conflict("slug_exists");
  return prisma.$transaction(async (tx) => {
    const { brand, ...rest } = input;
    const after = await tx.product.update({ where: { id }, data: { ...rest, brandId: await brandId(tx, brand) } });
    await audit(ctx, { action: "product.update", entityType: "Product", entityId: id, before, after }, tx);
    return after;
  });
}

export async function upsertVariant(ctx: AuthContext, productId: string, variantId: string | null, v: VariantInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound();
  const clash = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
  if (clash && clash.id !== variantId) throw conflict("sku_exists");
  if (v.barcode) {
    const b = await prisma.productVariant.findUnique({ where: { barcode: v.barcode } });
    if (b && b.id !== variantId) throw conflict("barcode_exists");
  }
  if (variantId) {
    const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!existing) throw notFound();
  }
  return prisma.$transaction(async (tx) => {
    const id = await writeVariant(tx, ctx, productId, v, variantId ?? undefined);
    await audit(ctx, { action: variantId ? "variant.update" : "variant.create", entityType: "ProductVariant", entityId: id, after: v }, tx);
    return { id };
  });
}

export async function addProductImage(ctx: AuthContext, productId: string, file: { data: Buffer; name: string }) {
  if (!(await prisma.product.findUnique({ where: { id: productId } }))) throw notFound();
  if (file.data.length > env().UPLOAD_MAX_MB * 1024 * 1024) throw badRequest("file_too_large");
  const mime = sniffMimeType(file.data);
  if (!mime || !mime.startsWith("image/")) throw badRequest("invalid_file_type");
  const stored = await storeFile({ data: file.data, mimeType: mime, originalName: file.name, purpose: "product-image", uploadedById: ctx.user.id });
  const count = await prisma.productImage.count({ where: { productId } });
  const img = await prisma.productImage.create({ data: { productId, fileId: stored.id, sortOrder: count } });
  await audit(ctx, { action: "product.image_add", entityType: "Product", entityId: productId, after: { fileId: stored.id } });
  return img;
}

export async function removeProductImage(ctx: AuthContext, productId: string, imageId: string) {
  const r = await prisma.productImage.deleteMany({ where: { id: imageId, productId } });
  if (r.count === 0) throw notFound();
  await audit(ctx, { action: "product.image_remove", entityType: "Product", entityId: productId, before: { imageId } });
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export async function upsertCategory(ctx: AuthContext, id: string | null, input: { slug: string; nameAr: string; nameEn: string; parentId?: string | null; sortOrder: number; active: boolean }) {
  const clash = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (clash && clash.id !== id) throw conflict("slug_exists");
  if (id && input.parentId === id) throw badRequest("invalid_parent");
  return prisma.$transaction(async (tx) => {
    const c = id ? await tx.category.update({ where: { id }, data: input }) : await tx.category.create({ data: input });
    await audit(ctx, { action: id ? "category.update" : "category.create", entityType: "Category", entityId: c.id, after: c }, tx);
    return c;
  });
}

export async function deleteCategory(ctx: AuthContext, id: string) {
  const c = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!c) throw notFound();
  if (c._count.products || c._count.children) throw new AppError(409, "category_in_use");
  await prisma.category.delete({ where: { id } });
  await audit(ctx, { action: "category.delete", entityType: "Category", entityId: id, before: c });
}

// ---------------------------------------------------------------------------
// Import / Export (Stammdaten ohne Preise)
// ---------------------------------------------------------------------------

export const PRODUCT_COLUMNS = ["sku", "product_slug", "name_ar", "name_en", "variant_name_ar", "variant_name_en", "category_slug", "brand", "barcode", "carton_factor", "min_stock", "bin", "active"] as const;

export async function exportProducts() {
  const rows = await prisma.productVariant.findMany({
    orderBy: { sku: "asc" },
    include: {
      product: { include: { category: true, brand: true } },
      units: { include: { unit: true } },
      defaultBin: true,
    },
  });
  return rows.map((v) => ({
    sku: v.sku,
    product_slug: v.product.slug,
    name_ar: v.product.nameAr,
    name_en: v.product.nameEn,
    variant_name_ar: v.nameAr ?? "",
    variant_name_en: v.nameEn ?? "",
    category_slug: v.product.category.slug,
    brand: v.product.brand?.name ?? "",
    barcode: v.barcode ?? "",
    carton_factor: String(v.units.find((u) => u.unit.code === "CARTON")?.factor ?? ""),
    min_stock: String(v.minStock),
    bin: v.defaultBin?.code ?? "",
    active: v.active ? "1" : "0",
  }));
}

export interface ProductImportRow {
  line: number;
  sku: string;
  action: "create" | "update" | "error";
  error?: string;
}

/**
 * Import: bestehende SKUs werden aktualisiert (Namen, Kategorie, Barcode, Karton, Mindestbestand, Platz);
 * neue SKUs legen ein Produkt (oder eine weitere Variante zu product_slug) an – ohne Preise, unsichtbar.
 */
export async function importProducts(ctx: AuthContext, rows: Record<string, string>[], apply: boolean): Promise<ProductImportRow[]> {
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  const existing = new Map((await prisma.productVariant.findMany({ select: { id: true, sku: true, productId: true } })).map((v) => [v.sku, v]));
  const products = new Map((await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const out: ProductImportRow[] = rows.map((r, i) => {
    const sku = (r.sku ?? "").trim();
    const line = i + 2;
    if (!sku) return { line, sku, action: "error", error: "unknown_sku" };
    if (!categories.has(r.category_slug ?? "")) return { line, sku, action: "error", error: "unknown_category" };
    if (r.barcode && !isValidGtin(r.barcode)) return { line, sku, action: "error", error: "invalid_barcode" };
    if (!r.name_ar || !r.name_en || !r.product_slug) return { line, sku, action: "error", error: "validation_error" };
    return { line, sku, action: existing.has(sku) ? "update" : "create" };
  });
  if (!apply || out.some((o) => o.action === "error")) return out;
  if (!hasPermission(ctx.permissions, "product.edit")) throw forbidden();
  await prisma.$transaction(
    async (tx) => {
      const units = new Map((await tx.unitOfMeasure.findMany()).map((u) => [u.code, u.id]));
      for (const r of rows) {
        const sku = r.sku!.trim();
        const carton = Number(r.carton_factor) || 0;
        const ex = existing.get(sku);
        let productId = ex?.productId ?? products.get(r.product_slug!);
        const productData = { nameAr: r.name_ar!, nameEn: r.name_en!, categoryId: categories.get(r.category_slug!)!, brandId: await brandId(tx, r.brand) };
        if (productId) await tx.product.update({ where: { id: productId }, data: productData });
        else {
          productId = (await tx.product.create({ data: { ...productData, slug: r.product_slug!, visibleB2B: false, visibleB2C: false } })).id;
          products.set(r.product_slug!, productId);
        }
        const vData = {
          barcode: r.barcode || null,
          nameAr: r.variant_name_ar || null,
          nameEn: r.variant_name_en || null,
          minStock: Number(r.min_stock) || 0,
          active: r.active !== "0",
          defaultBinId: await binId(tx, r.bin),
        };
        const variantId = ex ? (await tx.productVariant.update({ where: { id: ex.id }, data: vData })).id : (await tx.productVariant.create({ data: { ...vData, sku, productId, costPrice: 0, b2cPrice: 0, b2bBasePrice: 0 } })).id;
        await tx.variantUnit.upsert({ where: { variantId_unitId: { variantId, unitId: units.get("PIECE")! } }, update: {}, create: { variantId, unitId: units.get("PIECE")!, factor: 1 } });
        if (carton > 1) {
          await tx.variantUnit.upsert({ where: { variantId_unitId: { variantId, unitId: units.get("CARTON")! } }, update: { factor: carton }, create: { variantId, unitId: units.get("CARTON")!, factor: carton } });
        }
        if (!ex) {
          await tx.variantChannelRule.createMany({
            data: [
              { variantId, channel: "B2C", defaultUnitId: units.get("PIECE")!, allowedUnitIds: [units.get("PIECE")!], minQtyBase: 1, qtyStepBase: 1 },
              {
                variantId,
                channel: "B2B",
                defaultUnitId: carton > 1 ? units.get("CARTON")! : units.get("PIECE")!,
                allowedUnitIds: carton > 1 ? [units.get("CARTON")!, units.get("PIECE")!] : [units.get("PIECE")!],
                minQtyBase: carton > 1 ? carton : 1,
                qtyStepBase: carton > 1 ? carton : 1,
              },
            ],
          });
        }
      }
      await audit(ctx, { action: "product.import", entityType: "Product", after: { rows: rows.length } }, tx);
    },
    { timeout: 60_000 },
  );
  return out;
}

// ---------------------------------------------------------------------------
// Schnell anlegen: Name, Kategorie (auch neu), Preise, Karton, Bestand, Fotos
// ---------------------------------------------------------------------------

export interface QuickProductInput {
  nameAr: string;
  nameEn?: string;
  categoryId?: string;
  newCategoryAr?: string;
  b2cPrice: number;
  b2bPrice?: number;
  costPrice?: number;
  /** Stück pro Karton (leer/1 = nur Stückverkauf) */
  cartonSize?: number;
  /** Anfangsbestand in Stück */
  stockQty?: number;
  barcode?: string;
  descriptionAr?: string;
}

/** lateinischer URL-Teil; arabische Namen bekommen einen kurzen Zufallsteil */
function slugFrom(name: string, fallbackPrefix: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const rnd = Math.random().toString(36).slice(2, 7);
  return base.length >= 3 ? `${base}-${rnd}` : `${fallbackPrefix}-${rnd}`;
}

async function nextSku() {
  for (let n = (await prisma.productVariant.count()) + 1; ; n++) {
    const sku = `P-${String(n).padStart(4, "0")}`;
    if (!(await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } }))) return sku;
  }
}

export async function createQuickProduct(ctx: AuthContext, input: QuickProductInput, images: { data: Buffer; name: string }[]) {
  // Kategorie: vorhandene oder neue direkt anlegen
  let categoryId = input.categoryId;
  if (!categoryId) {
    const name = input.newCategoryAr?.trim();
    if (!name) throw badRequest("category_required");
    const existing = await prisma.category.findFirst({ where: { OR: [{ nameAr: name }, { nameEn: name }] } });
    categoryId = existing
      ? existing.id
      : (await upsertCategory(ctx, null, { slug: slugFrom(name, "cat"), nameAr: name, nameEn: name, parentId: null, sortOrder: await prisma.category.count(), active: true })).id;
  } else if (!(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    throw badRequest("category_required");
  }

  const carton = input.cartonSize && input.cartonSize > 1 ? input.cartonSize : null;
  const sku = await nextSku();
  const nameEn = input.nameEn?.trim() || input.nameAr;
  const product = await createProduct(
    ctx,
    {
      slug: slugFrom(nameEn, "p"),
      nameAr: input.nameAr,
      nameEn,
      descriptionAr: input.descriptionAr,
      descriptionEn: undefined,
      categoryId,
      brand: undefined,
      visibleB2C: true,
      visibleB2B: true,
      active: true,
    },
    {
      sku,
      barcode: input.barcode || null,
      nameAr: undefined,
      nameEn: undefined,
      costPrice: input.costPrice ?? 0,
      b2cPrice: input.b2cPrice,
      // ohne eigenen Händlerpreis: Endkundenpreis als Basis (Rabatte über Händlergruppen)
      b2bBasePrice: input.b2bPrice ?? input.b2cPrice,
      minStock: 0,
      defaultBinCode: undefined,
      active: true,
      units: [{ unitCode: "PIECE", factor: 1, barcode: null }, ...(carton ? [{ unitCode: "CARTON" as const, factor: carton, barcode: null }] : [])],
      rules: [
        { channel: "B2C", defaultUnitCode: "PIECE", allowedUnitCodes: carton ? ["PIECE", "CARTON"] : ["PIECE"], minQtyBase: 1, qtyStepBase: 1 },
        { channel: "B2B", defaultUnitCode: carton ? "CARTON" : "PIECE", allowedUnitCodes: carton ? ["CARTON", "PIECE"] : ["PIECE"], minQtyBase: 1, qtyStepBase: 1 },
      ],
    },
  );
  for (const img of images) await addProductImage(ctx, product.id, img);
  if (input.stockQty && input.stockQty > 0 && hasPermission(ctx.permissions, "stock.adjust")) {
    const { adjustStock } = await import("./inventory");
    await adjustStock(ctx, { sku, qtyBase: input.stockQty, reason: "Anfangsbestand / رصيد افتتاحي" });
  }
  return { id: product.id, sku };
}

/** Im Shop anzeigen/ausblenden (ein Klick) */
export async function setProductActive(ctx: AuthContext, id: string, active: boolean) {
  const before = await prisma.product.findUnique({ where: { id }, select: { active: true, archivedAt: true } });
  if (!before) throw notFound();
  const after = await prisma.product.update({ where: { id }, data: { active, ...(active ? { archivedAt: null } : {}) }, select: { id: true, active: true } });
  await audit(ctx, { action: active ? "product.activate" : "product.deactivate", entityType: "Product", entityId: id, before, after });
  return after;
}

/**
 * Löschen: nie verkauft/bestellt/eingelagert → endgültig löschen.
 * Sonst archivieren (ausgeblendet, Belege bleiben unverändert gültig).
 */
export async function deleteProduct(ctx: AuthContext, id: string) {
  const p = await prisma.product.findUnique({ where: { id }, include: { variants: { select: { id: true } } } });
  if (!p) throw notFound();
  const ids = p.variants.map((v) => v.id);
  const used = ids.length
    ? (
        await Promise.all([
          prisma.orderItem.count({ where: { variantId: { in: ids } } }),
          prisma.quoteItem.count({ where: { variantId: { in: ids } } }),
          prisma.purchaseOrderItem.count({ where: { variantId: { in: ids } } }),
          prisma.goodsReceiptItem.count({ where: { variantId: { in: ids } } }),
          prisma.stocktakeLine.count({ where: { variantId: { in: ids } } }),
          prisma.stockReservation.count({ where: { variantId: { in: ids } } }),
          prisma.stockMovement.count({ where: { variantId: { in: ids }, type: { notIn: ["ADJUSTMENT"] } } }),
        ])
      ).some((n) => n > 0)
    : false;
  if (used) {
    await prisma.product.update({ where: { id }, data: { active: false, archivedAt: new Date() } });
    await audit(ctx, { action: "product.archive", entityType: "Product", entityId: id, before: { name: p.nameAr } });
    return { mode: "archived" as const };
  }
  await prisma.$transaction(async (tx) => {
    const v = { variantId: { in: ids } };
    await tx.cartItem.deleteMany({ where: v });
    await tx.savedOrderListItem.deleteMany({ where: v });
    await tx.priceListItem.deleteMany({ where: v });
    await tx.tierPrice.deleteMany({ where: v });
    await tx.customerPrice.deleteMany({ where: v });
    await tx.promotionTarget.deleteMany({ where: { OR: [v, { productId: id }] } });
    await tx.scheduledPriceChange.deleteMany({ where: v });
    await tx.priceHistory.deleteMany({ where: v });
    await tx.stockMovement.deleteMany({ where: v });
    await tx.stockLevel.deleteMany({ where: v });
    await tx.variantUnit.deleteMany({ where: v });
    await tx.variantChannelRule.deleteMany({ where: v });
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productVariant.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    await audit(ctx, { action: "product.delete", entityType: "Product", entityId: id, before: { name: p.nameAr, skus: ids.length } }, tx);
  });
  return { mode: "deleted" as const };
}
