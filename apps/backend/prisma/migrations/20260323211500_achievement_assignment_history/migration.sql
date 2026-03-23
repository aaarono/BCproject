CREATE TABLE "AchievementAssignment" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AchievementAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AchievementAssignment_createdAt_idx" ON "AchievementAssignment"("createdAt");
CREATE INDEX "AchievementAssignment_adminId_createdAt_idx" ON "AchievementAssignment"("adminId", "createdAt");
CREATE INDEX "AchievementAssignment_userId_createdAt_idx" ON "AchievementAssignment"("userId", "createdAt");

ALTER TABLE "AchievementAssignment"
  ADD CONSTRAINT "AchievementAssignment_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AchievementAssignment"
  ADD CONSTRAINT "AchievementAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AchievementAssignment"
  ADD CONSTRAINT "AchievementAssignment_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
