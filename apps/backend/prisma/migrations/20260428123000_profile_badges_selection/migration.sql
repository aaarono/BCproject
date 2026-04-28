-- CreateTable
CREATE TABLE IF NOT EXISTS "UserProfileBadge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserProfileBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfileBadge_userId_definitionId_key" ON "UserProfileBadge"("userId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfileBadge_userId_sortOrder_key" ON "UserProfileBadge"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserProfileBadge_userId_sortOrder_idx" ON "UserProfileBadge"("userId", "sortOrder");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserProfileBadge_userId_fkey'
  ) THEN
    ALTER TABLE "UserProfileBadge"
    ADD CONSTRAINT "UserProfileBadge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserProfileBadge_definitionId_fkey'
  ) THEN
    ALTER TABLE "UserProfileBadge"
    ADD CONSTRAINT "UserProfileBadge_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "AchievementDefinition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
