CREATE TABLE IF NOT EXISTS "SystemNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "senderAdminId" TEXT,
  "title" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SystemNotification_userId_createdAt_idx"
  ON "SystemNotification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "SystemNotification_userId_readAt_idx"
  ON "SystemNotification"("userId", "readAt");

CREATE INDEX IF NOT EXISTS "SystemNotification_senderAdminId_createdAt_idx"
  ON "SystemNotification"("senderAdminId", "createdAt");

ALTER TABLE "SystemNotification"
  ADD CONSTRAINT "SystemNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SystemNotification"
  ADD CONSTRAINT "SystemNotification_senderAdminId_fkey"
  FOREIGN KEY ("senderAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AchievementDefinition" ("id", "code", "title", "description") VALUES
  ('achv_weekly_champion', 'WEEKLY_CHAMPION', 'Weekly Champion', 'Win Weekly Top Sellers at least once.'),
  ('achv_weekly_streak_2', 'WEEKLY_STREAK_2', 'Hot Streak II', 'Win Weekly Top Sellers for 2 weeks in a row.'),
  ('achv_weekly_streak_4', 'WEEKLY_STREAK_4', 'Hot Streak IV', 'Win Weekly Top Sellers for 4 weeks in a row.'),
  ('achv_weekly_streak_8', 'WEEKLY_STREAK_8', 'Legendary Streak VIII', 'Win Weekly Top Sellers for 8 weeks in a row.')
ON CONFLICT ("code") DO NOTHING;
