UPDATE "Product"
SET "priceWithVat" = CEIL("priceWithVat")
WHERE "priceWithVat" IS NOT NULL
  AND "priceWithVat" > 0
  AND "priceWithVat" <> CEIL("priceWithVat");
