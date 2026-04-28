ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isBannedPermanent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "bannedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "banReason" TEXT,
ADD COLUMN IF NOT EXISTS "warningStage" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "UserWarning" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuedByAdminId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedByAdminId" TEXT,
  CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserWarning_userId_fkey'
      AND table_name = 'UserWarning'
  ) THEN
    ALTER TABLE "UserWarning"
    ADD CONSTRAINT "UserWarning_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserWarning_issuedByAdminId_fkey'
      AND table_name = 'UserWarning'
  ) THEN
    ALTER TABLE "UserWarning"
    ADD CONSTRAINT "UserWarning_issuedByAdminId_fkey"
    FOREIGN KEY ("issuedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserWarning_revokedByAdminId_fkey'
      AND table_name = 'UserWarning'
  ) THEN
    ALTER TABLE "UserWarning"
    ADD CONSTRAINT "UserWarning_revokedByAdminId_fkey"
    FOREIGN KEY ("revokedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "UserWarning_userId_createdAt_idx"
ON "UserWarning"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserWarning_userId_expiresAt_revokedAt_idx"
ON "UserWarning"("userId", "expiresAt", "revokedAt");

CREATE INDEX IF NOT EXISTS "UserWarning_issuedByAdminId_createdAt_idx"
ON "UserWarning"("issuedByAdminId", "createdAt");
