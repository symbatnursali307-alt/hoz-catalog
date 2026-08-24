-- Turn the existing CartSubmission snapshot into the durable order record.
-- Existing rows are preserved and receive chronological human-facing numbers.
CREATE SEQUENCE "CartSubmission_orderNumber_seq" AS INTEGER START WITH 10001;

ALTER TABLE "CartSubmission"
ADD COLUMN "orderNumber" INTEGER,
ADD COLUMN "accessToken" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "itemCount" INTEGER,
ADD COLUMN "managerNameSnapshot" TEXT,
ADD COLUMN "managerPhoneSnapshot" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

WITH numbered AS (
  SELECT
    "id",
    10000 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS next_number
  FROM "CartSubmission"
)
UPDATE "CartSubmission" AS submission
SET "orderNumber" = numbered.next_number
FROM numbered
WHERE numbered."id" = submission."id";

UPDATE "CartSubmission"
SET
  "accessToken" = REPLACE(gen_random_uuid()::TEXT, '-', '') || REPLACE(gen_random_uuid()::TEXT, '-', ''),
  "itemCount" = jsonb_array_length("items"),
  "updatedAt" = "createdAt";

UPDATE "CartSubmission" AS submission
SET
  "managerNameSnapshot" = manager."name",
  "managerPhoneSnapshot" = manager."whatsappPhone"
FROM "Manager" AS manager
WHERE manager."id" = submission."managerId";

-- Older snapshots did not include images, slugs or a dedicated SKU. Backfill
-- the best currently available values once; after this migration the snapshot
-- is never recalculated from Product.
UPDATE "CartSubmission" AS submission
SET "items" = COALESCE((
  SELECT jsonb_agg(
    element.item || jsonb_build_object(
      'imageUrl', COALESCE(NULLIF(element.item->>'imageUrl', ''), product."imageUrl", product."photo", ''),
      'productSlug', COALESCE(NULLIF(element.item->>'productSlug', ''), product."slug", ''),
      'sku', COALESCE(NULLIF(element.item->>'sku', ''), product."externalId", product."metaCatalogId", '')
    )
    ORDER BY element.ordinality
  )
  FROM jsonb_array_elements(submission."items") WITH ORDINALITY AS element(item, ordinality)
  LEFT JOIN "Product" AS product ON product."id" = element.item->>'productId'
), '[]'::jsonb);

SELECT setval(
  '"CartSubmission_orderNumber_seq"',
  GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "CartSubmission"), 10000), 10000),
  true
);

ALTER SEQUENCE "CartSubmission_orderNumber_seq"
OWNED BY "CartSubmission"."orderNumber";

ALTER TABLE "CartSubmission"
ALTER COLUMN "orderNumber" SET DEFAULT nextval('"CartSubmission_orderNumber_seq"'),
ALTER COLUMN "orderNumber" SET NOT NULL,
ALTER COLUMN "accessToken" SET NOT NULL,
ALTER COLUMN "itemCount" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX "CartSubmission_orderNumber_key" ON "CartSubmission"("orderNumber");
CREATE UNIQUE INDEX "CartSubmission_accessToken_key" ON "CartSubmission"("accessToken");
CREATE UNIQUE INDEX "CartSubmission_idempotencyKey_key" ON "CartSubmission"("idempotencyKey");
