-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('GAMES', 'ACCOUNTS', 'BOOSTING', 'MENTORING', 'GAME_CURRENCY', 'OTHER');

-- AlterTable
ALTER TABLE "Listing"
ADD COLUMN "category" "ListingCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");
