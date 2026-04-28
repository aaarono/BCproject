#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

npx prisma generate

echo "Starting backend in production mode..."
exec npm run start:prod
