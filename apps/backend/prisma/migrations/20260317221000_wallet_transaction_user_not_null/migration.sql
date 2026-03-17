-- Backfill nullable rows
UPDATE "WalletTransaction"
SET "userId" = "walletId"
WHERE "userId" IS NULL;

-- Enforce required userId
ALTER TABLE "WalletTransaction"
ALTER COLUMN "userId" SET NOT NULL;
