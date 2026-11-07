-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('WELCOME', 'CART_THRESHOLD', 'COUPON', 'FREE_DELIVERY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "freeDeliveryOfferId" TEXT,
ADD COLUMN     "offerDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offerId" TEXT;

-- CreateTable
CREATE TABLE "OrderOffer" (
    "id" TEXT NOT NULL,
    "kind" "OfferKind" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "textAr" TEXT,
    "textEn" TEXT,
    "channel" "ChannelScope" NOT NULL DEFAULT 'BOTH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "percentBps" INTEGER,
    "amountAgorot" INTEGER,
    "minOrderAgorot" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "maxUses" INTEGER,
    "perCustomerLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "showInShop" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderOfferRedemption" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderOfferRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderOffer_code_key" ON "OrderOffer"("code");

-- CreateIndex
CREATE INDEX "OrderOffer_kind_active_idx" ON "OrderOffer"("kind", "active");

-- CreateIndex
CREATE INDEX "OrderOfferRedemption_offerId_customerId_idx" ON "OrderOfferRedemption"("offerId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOfferRedemption_offerId_orderId_key" ON "OrderOfferRedemption"("offerId", "orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "OrderOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOfferRedemption" ADD CONSTRAINT "OrderOfferRedemption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "OrderOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOfferRedemption" ADD CONSTRAINT "OrderOfferRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOfferRedemption" ADD CONSTRAINT "OrderOfferRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
