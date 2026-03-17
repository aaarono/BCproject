#!/bin/sh
set -e

if ! npx prisma migrate deploy; then
	echo "prisma migrate deploy failed, fallback to prisma db push"
	npx prisma db push
fi
npx prisma generate

exec npm run start:dev
