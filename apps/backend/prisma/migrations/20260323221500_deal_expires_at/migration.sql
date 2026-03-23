ALTER TABLE "Deal"
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "Deal"
SET "expiresAt" = "createdAt" + INTERVAL '24 hours'
WHERE "status" IN ('INITIATED', 'FUNDED')
  AND "expiresAt" IS NULL;

CREATE INDEX "Deal_status_expiresAt_idx" ON "Deal"("status", "expiresAt");
