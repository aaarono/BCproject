DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportTargetType') THEN
    CREATE TYPE "ReportTargetType" AS ENUM ('LISTING', 'USER', 'REVIEW', 'DEAL', 'MESSAGE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportStatus') THEN
    CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Report_reporterId_fkey'
      AND table_name = 'Report'
  ) THEN
    ALTER TABLE "Report"
    ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Report_reviewedByAdminId_fkey'
      AND table_name = 'Report'
  ) THEN
    ALTER TABLE "Report"
    ADD CONSTRAINT "Report_reviewedByAdminId_fkey"
    FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Report_reporterId_createdAt_idx"
ON "Report"("reporterId", "createdAt");

CREATE INDEX IF NOT EXISTS "Report_targetType_targetId_idx"
ON "Report"("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx"
ON "Report"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Report_reviewedByAdminId_reviewedAt_idx"
ON "Report"("reviewedByAdminId", "reviewedAt");
