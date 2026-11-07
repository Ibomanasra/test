-- Mindestbestand automatisch (10 % nach Auffüllung) + einmalige Warnung beim Unterschreiten
ALTER TABLE "ProductVariant" ADD COLUMN "minStockAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lowStockAlertedAt" TIMESTAMP(3);
-- Von Hand gepflegte Mindestbestände bleiben unverändert
UPDATE "ProductVariant" SET "minStockAuto" = false WHERE "minStock" > 0;
-- Für automatische: 10 % des aktuellen Bestands (aufgerundet)
UPDATE "ProductVariant" v SET "minStock" = CEIL(GREATEST(s."avail", 0) * 0.1)
FROM (SELECT "variantId", SUM("onHand" - "reserved") AS "avail" FROM "StockLevel" GROUP BY "variantId") s
WHERE s."variantId" = v."id" AND v."minStockAuto" AND s."avail" > 0;
