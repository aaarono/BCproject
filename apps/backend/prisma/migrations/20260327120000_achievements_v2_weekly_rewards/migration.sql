-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WeeklyCompetitionStatus') THEN
    CREATE TYPE "WeeklyCompetitionStatus" AS ENUM ('PENDING', 'FINALIZED', 'CANCELED');
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'WEEKLY_REWARD';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "activeBadgeDefinitionId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyCompetition" (
  "id" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "status" "WeeklyCompetitionStatus" NOT NULL DEFAULT 'PENDING',
  "winnerUserId" TEXT,
  "rewardAmount" INTEGER NOT NULL DEFAULT 0,
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyWinner" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "completedDeals" INTEGER NOT NULL,
  "ratingAvgSnapshot" DOUBLE PRECISION NOT NULL,
  "ratingCountSnapshot" INTEGER NOT NULL,
  "activeListings" INTEGER NOT NULL,
  "streakAfterWin" INTEGER NOT NULL,
  "rewardAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserWeeklyStats" (
  "userId" TEXT NOT NULL,
  "totalWins" INTEGER NOT NULL DEFAULT 0,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "bestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastWinWeekStart" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserWeeklyStats_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyCompetition_weekStart_key" ON "WeeklyCompetition"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyWinner_competitionId_key" ON "WeeklyWinner"("competitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_activeBadgeDefinitionId_idx" ON "User"("activeBadgeDefinitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyCompetition_status_weekStart_idx" ON "WeeklyCompetition"("status", "weekStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyCompetition_winnerUserId_weekStart_idx" ON "WeeklyCompetition"("winnerUserId", "weekStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyWinner_userId_createdAt_idx" ON "WeeklyWinner"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyWinner_createdAt_idx" ON "WeeklyWinner"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_activeBadgeDefinitionId_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_activeBadgeDefinitionId_fkey"
    FOREIGN KEY ("activeBadgeDefinitionId") REFERENCES "AchievementDefinition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCompetition_winnerUserId_fkey'
  ) THEN
    ALTER TABLE "WeeklyCompetition"
    ADD CONSTRAINT "WeeklyCompetition_winnerUserId_fkey"
    FOREIGN KEY ("winnerUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyWinner_competitionId_fkey'
  ) THEN
    ALTER TABLE "WeeklyWinner"
    ADD CONSTRAINT "WeeklyWinner_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "WeeklyCompetition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyWinner_userId_fkey'
  ) THEN
    ALTER TABLE "WeeklyWinner"
    ADD CONSTRAINT "WeeklyWinner_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserWeeklyStats_userId_fkey'
  ) THEN
    ALTER TABLE "UserWeeklyStats"
    ADD CONSTRAINT "UserWeeklyStats_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
