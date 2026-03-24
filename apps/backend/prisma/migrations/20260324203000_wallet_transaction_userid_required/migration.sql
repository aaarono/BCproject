UPDATE "public"."WalletTransaction"
SET "userId" = "walletId"
WHERE "userId" IS NULL;

ALTER TABLE "public"."WalletTransaction"
DROP CONSTRAINT IF EXISTS "WalletTransaction_userId_fkey";

ALTER TABLE "public"."WalletTransaction"
ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "public"."WalletTransaction"
ADD CONSTRAINT "WalletTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
