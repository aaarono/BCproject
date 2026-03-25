-- AlterTable
ALTER TABLE "ListingPriceHistory"
ADD COLUMN "isSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salePercent" INTEGER;

-- CreateIndex
CREATE INDEX "ListingPriceHistory_listingId_isSale_createdAt_idx"
ON "ListingPriceHistory"("listingId", "isSale", "createdAt");
