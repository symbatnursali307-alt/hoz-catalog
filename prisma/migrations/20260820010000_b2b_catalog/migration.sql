-- Canonical B2B product fields are introduced alongside legacy fields so the
-- recovered catalog can be normalized without guessing missing packaging data.
ALTER TABLE "Product"
ADD COLUMN "brand" TEXT,
ADD COLUMN "buyerHint" TEXT,
ADD COLUMN "characteristics" JSONB,
ADD COLUMN "fbProductCategory" TEXT,
ADD COLUMN "fullDescription" TEXT,
ADD COLUMN "googleProductCategory" TEXT,
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metaCatalogId" TEXT,
ADD COLUMN "minOrderPackages" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "searchKeywords" TEXT,
ADD COLUMN "shortDescription" TEXT,
ADD COLUMN "slug" TEXT,
ADD COLUMN "unitName" TEXT,
ADD COLUMN "unitsPerPackage" INTEGER;

WITH bases AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(COALESCE(NULLIF("externalId", ''), "id"), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
      "id"
    ) AS base_slug
  FROM "Product"
), ranked AS (
  SELECT "id", base_slug, ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY "id") AS duplicate_number
  FROM bases
)
UPDATE "Product" AS product
SET "slug" = CASE
  WHEN ranked.duplicate_number = 1 THEN ranked.base_slug
  ELSE ranked.base_slug || '-' || SUBSTRING(product."id" FROM 1 FOR 8)
END
FROM ranked
WHERE ranked."id" = product."id";

UPDATE "Product"
SET
  "shortDescription" = COALESCE("shortDescription", "description"),
  "fullDescription" = COALESCE("fullDescription", "description"),
  "unitName" = COALESCE("unitName", "unit"),
  "unitsPerPackage" = COALESCE("unitsPerPackage", "packageQuantity"),
  "imageUrl" = COALESCE("imageUrl", "photo"),
  "metaCatalogId" = COALESCE("metaCatalogId", "slug");

ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "AppSettings" ADD COLUMN "cartEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsappPhone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartSubmission" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "managerId" TEXT,
    "phone" TEXT NOT NULL,
    "customerName" TEXT,
    "items" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "whatsappText" TEXT NOT NULL,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "managerId" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "phoneHash" TEXT,
    "cartTotal" DOUBLE PRECISION,
    "itemsCount" INTEGER,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "metadata" JSONB,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "metaEventName" TEXT,
    "metaSentAt" TIMESTAMP(3),
    "metaError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Manager_slug_key" ON "Manager"("slug");
CREATE INDEX "Manager_isActive_isDefault_idx" ON "Manager"("isActive", "isDefault");
CREATE UNIQUE INDEX "CartSubmission_publicId_key" ON "CartSubmission"("publicId");
CREATE INDEX "CartSubmission_createdAt_idx" ON "CartSubmission"("createdAt");
CREATE INDEX "CartSubmission_managerId_createdAt_idx" ON "CartSubmission"("managerId", "createdAt");
CREATE INDEX "CartSubmission_visitorId_idx" ON "CartSubmission"("visitorId");
CREATE INDEX "CartSubmission_sessionId_idx" ON "CartSubmission"("sessionId");
CREATE UNIQUE INDEX "AnalyticsEvent_eventId_key" ON "AnalyticsEvent"("eventId");
CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx" ON "AnalyticsEvent"("eventName", "createdAt");
CREATE INDEX "AnalyticsEvent_productId_eventName_createdAt_idx" ON "AnalyticsEvent"("productId", "eventName", "createdAt");
CREATE INDEX "AnalyticsEvent_categoryId_eventName_createdAt_idx" ON "AnalyticsEvent"("categoryId", "eventName", "createdAt");
CREATE INDEX "AnalyticsEvent_managerId_eventName_createdAt_idx" ON "AnalyticsEvent"("managerId", "eventName", "createdAt");
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_metaCatalogId_key" ON "Product"("metaCatalogId");

ALTER TABLE "CartSubmission" ADD CONSTRAINT "CartSubmission_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the only recovered manager number as the default route. A second real
-- manager must be added through the admin UI; no phone number is fabricated.
INSERT INTO "Manager" ("id", "name", "slug", "whatsappPhone", "isActive", "isDefault", "createdAt", "updatedAt")
SELECT
  'manager-default',
  'Основной менеджер',
  'a',
  REGEXP_REPLACE("whatsappPhone", '[^0-9]+', '', 'g'),
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppSettings"
WHERE "id" = 'default'
  AND NULLIF(REGEXP_REPLACE(COALESCE("whatsappPhone", ''), '[^0-9]+', '', 'g'), '') IS NOT NULL
ON CONFLICT ("slug") DO NOTHING;
