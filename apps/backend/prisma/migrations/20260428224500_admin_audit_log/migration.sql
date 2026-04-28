CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "requestId" TEXT,
  "summary" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_actorAdminId_fkey'
      AND table_name = 'AuditLog'
  ) THEN
    ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorAdminId_fkey"
    FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "AuditLog_actorAdminId_createdAt_idx"
ON "AuditLog"("actorAdminId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
ON "AuditLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx"
ON "AuditLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"
ON "AuditLog"("createdAt");
