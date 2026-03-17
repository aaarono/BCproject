-- Alter listing with flash sales fields
ALTER TABLE "Listing"
ADD COLUMN "salePercent" INTEGER,
ADD COLUMN "saleStartsAt" TIMESTAMP(3),
ADD COLUMN "saleEndsAt" TIMESTAMP(3);

-- Price history for anti-abuse and charting
CREATE TABLE "ListingPriceHistory" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingPriceHistory_listingId_createdAt_idx"
ON "ListingPriceHistory"("listingId", "createdAt");

ALTER TABLE "ListingPriceHistory"
ADD CONSTRAINT "ListingPriceHistory_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
