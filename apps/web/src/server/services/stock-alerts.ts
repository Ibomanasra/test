import "server-only";
import { prisma, type Tx } from "@sa/db";
import { pushToUsers } from "../adapters/push";
import { escapeHtml, sendTelegram } from "../adapters/telegram";

/** Warnschwelle: 10 % des Bestands nach der letzten Auffüllung (aufgerundet) */
export const LOW_STOCK_SHARE = 0.1;

async function availableOf(db: Tx | typeof prisma, variantIds: string[]) {
  const levels = await db.stockLevel.groupBy({ by: ["variantId"], where: { variantId: { in: variantIds } }, _sum: { onHand: true, reserved: true } });
  return new Map(levels.map((l) => [l.variantId, { onHand: l._sum.onHand ?? 0, available: (l._sum.onHand ?? 0) - (l._sum.reserved ?? 0) }]));
}

/**
 * Nach einer Auffüllung (Wareneingang, Korrektur +, Inventur, Rückgabe):
 * automatischer Mindestbestand = 10 % des neuen Bestands; Warnung wieder „scharf“ schalten.
 */
export async function afterStockIncrease(tx: Tx, variantIds: string[]) {
  const ids = [...new Set(variantIds)];
  if (!ids.length) return;
  const stock = await availableOf(tx, ids);
  const variants = await tx.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, minStockAuto: true, minStock: true } });
  for (const v of variants) {
    const s = stock.get(v.id);
    if (!s) continue;
    const minStock = v.minStockAuto ? Math.ceil(Math.max(0, s.available) * LOW_STOCK_SHARE) : v.minStock;
    await tx.productVariant.update({
      where: { id: v.id },
      data: { minStock, ...(s.available > minStock ? { lowStockAlertedAt: null } : {}) },
    });
  }
}

/**
 * Nach einem Verkauf/Abgang: fällt der verfügbare Bestand auf den Mindestbestand (10 %) oder darunter,
 * bekommen Lager und Büro einmalig eine Benachrichtigung. Fehler blockieren nie den Vorgang.
 */
export async function checkLowStock(variantIds: string[]) {
  const ids = [...new Set(variantIds)];
  if (!ids.length) return;
  try {
    const stock = await availableOf(prisma, ids);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: ids }, active: true, lowStockAlertedAt: null, minStock: { gt: 0 } },
      select: { id: true, sku: true, minStock: true, nameAr: true, productId: true, product: { select: { nameAr: true } } },
    });
    const low = variants.filter((v) => (stock.get(v.id)?.available ?? 0) <= v.minStock);
    if (!low.length) return;
    // gleichzeitige Verkäufe: nur wer den Zeitstempel setzt, verschickt
    const claimed: typeof low = [];
    for (const v of low) {
      const r = await prisma.productVariant.updateMany({ where: { id: v.id, lowStockAlertedAt: null }, data: { lowStockAlertedAt: new Date() } });
      if (r.count) claimed.push(v);
    }
    if (!claimed.length) return;
    const staff = await prisma.user.findMany({
      where: { kind: "STAFF", isActive: true, roles: { some: { role: { permissions: { hasSome: ["stock.view", "*"] } } } } },
      select: { id: true },
    });
    for (const v of claimed) {
      const left = Math.max(0, stock.get(v.id)?.available ?? 0);
      const name = [v.product.nameAr, v.nameAr].filter(Boolean).join(" – ");
      await pushToUsers(staff.map((u) => u.id), {
        title: left === 0 ? `⛔ نفد من المخزون / Out of stock` : `⚠️ مخزون منخفض / Low stock`,
        body: `${name} (${v.sku}): ${left}`,
        data: { url: `/ar/admin/products/${v.productId}`, tag: `low-${v.id}` },
      });
      await sendTelegram(
        "stock.low",
        `${left === 0 ? "⛔ <b>نفد من المخزون</b>" : "⚠️ <b>مخزون منخفض</b>"}\n${escapeHtml(name)} (${escapeHtml(v.sku)})\nالمتبقي: <b>${left}</b>`,
        { url: `/ar/admin/products/${v.productId}`, label: "فتح المنتج" },
      );
    }
  } catch (err) {
    console.error("[low-stock]", err);
  }
}
