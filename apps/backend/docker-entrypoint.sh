#!/bin/sh
set -e

if ! npx prisma migrate deploy; then
	echo "prisma migrate deploy failed, fallback to prisma db push"
	npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL' || true
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingCategory') THEN
		CREATE TYPE "ListingCategory" AS ENUM ('GAMES','ACCOUNTS','BOOSTING','MENTORING','GAME_CURRENCY','OTHER');
	END IF;
END
$$;

ALTER TABLE "Listing"
ADD COLUMN IF NOT EXISTS "category" "ListingCategory" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "Listing"
ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "WalletTransaction"
SET "userId" = "walletId"
WHERE "userId" IS NULL;
SQL

	npx prisma db push
fi
npx prisma generate

exec npm run start:dev
