CREATE TYPE "DealCancellationActor" AS ENUM ('BUYER', 'SELLER', 'SYSTEM');

ALTER TABLE "Deal"
ADD COLUMN "canceledByActor" "DealCancellationActor";
