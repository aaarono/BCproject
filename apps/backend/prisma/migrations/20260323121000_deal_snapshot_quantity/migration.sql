ALTER TABLE "Deal"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "unitPriceSnapshot" INTEGER,
ADD COLUMN "totalAmountSnapshot" INTEGER;

UPDATE "Deal" d
SET
  "unitPriceSnapshot" = l."price",
  "totalAmountSnapshot" = l."price" * COALESCE(d."quantity", 1)
FROM "Listing" l
WHERE l."id" = d."listingId";

ALTER TABLE "Deal"
ALTER COLUMN "unitPriceSnapshot" SET NOT NULL,
ALTER COLUMN "totalAmountSnapshot" SET NOT NULL;