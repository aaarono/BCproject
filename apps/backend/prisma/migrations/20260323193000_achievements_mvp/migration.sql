CREATE TYPE "AchievementCode" AS ENUM (
  'FIRST_SALE',
  'TRUSTED_SELLER',
  'TOP_RATED',
  'CATALOG_BUILDER'
);

CREATE TABLE "AchievementDefinition" (
  "id" TEXT NOT NULL,
  "code" "AchievementCode" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAchievement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AchievementDefinition_code_key" ON "AchievementDefinition"("code");
CREATE UNIQUE INDEX "UserAchievement_userId_definitionId_key" ON "UserAchievement"("userId", "definitionId");
CREATE INDEX "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId", "unlockedAt");

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AchievementDefinition" ("id", "code", "title", "description")
VALUES
  ('achv_first_sale', 'FIRST_SALE', 'First Sale', 'Complete your first successful sale.'),
  ('achv_trusted_seller', 'TRUSTED_SELLER', 'Trusted Seller', 'Keep strong ratings across multiple completed deals.'),
  ('achv_top_rated', 'TOP_RATED', 'Top Rated', 'Reach excellent buyer feedback at scale.'),
  ('achv_catalog_builder', 'CATALOG_BUILDER', 'Catalog Builder', 'Maintain a broad set of active listings.');
