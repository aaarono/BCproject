ALTER TABLE "AchievementDefinition"
  ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;

DROP TYPE "AchievementCode";
