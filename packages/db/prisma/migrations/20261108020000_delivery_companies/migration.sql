-- Externe Zustellfirmen + Übergabe je Lieferschein
CREATE TABLE "DeliveryCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeliveryCompany_name_key" ON "DeliveryCompany"("name");

ALTER TABLE "Shipment" ADD COLUMN "deliveryCompanyId" TEXT,
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "handedOverAt" TIMESTAMP(3);
CREATE INDEX "Shipment_deliveryCompanyId_idx" ON "Shipment"("deliveryCompanyId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_deliveryCompanyId_fkey" FOREIGN KEY ("deliveryCompanyId") REFERENCES "DeliveryCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
