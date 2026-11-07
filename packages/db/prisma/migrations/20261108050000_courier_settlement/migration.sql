-- Nachnahme über Zustellfirmen: kassierter Betrag je Lieferschein + Abrechnung (Geld an uns)
CREATE TABLE "CourierSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourierSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourierSettlement_companyId_createdAt_idx" ON "CourierSettlement"("companyId", "createdAt");
ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeliveryCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment" ADD COLUMN "codAmount" INTEGER,
ADD COLUMN "courierSettlementId" TEXT;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierSettlementId_fkey" FOREIGN KEY ("courierSettlementId") REFERENCES "CourierSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
