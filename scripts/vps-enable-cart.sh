#!/usr/bin/env bash
set -Eeuo pipefail

source /root/katalog-hoz-secrets.env

backup_dir=/srv/katalog-hoz/shared/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database_backup="$backup_dir/postgresql-pre-cart-enable-$timestamp.dump"

echo '[1/3] Creating and validating a pre-change PostgreSQL backup'
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  --format=custom \
  --file="$database_backup"
pg_restore --list "$database_backup" >/dev/null
chmod 600 "$database_backup"

echo '[2/3] Checking safety gates and enabling the cart'
PGPASSWORD="$DB_PASSWORD" psql \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  -v ON_ERROR_STOP=1 \
  -P pager=off <<'SQL'
SET lock_timeout = '5s';
SET statement_timeout = '30s';
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AppSettings" WHERE "id" = 'default') THEN
    RAISE EXCEPTION 'Default application settings do not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "Manager"
    WHERE "isActive" = true
      AND length(regexp_replace("whatsappPhone", '\D', '', 'g')) BETWEEN 7 AND 15
  ) THEN
    RAISE EXCEPTION 'No active manager with a valid WhatsApp number';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "Product"
    WHERE "isActive" = true
      AND "priceWithVat" > 0
      AND COALESCE("unitName", '') <> ''
      AND COALESCE("packageType", '') <> ''
      AND "unitsPerPackage" > 0
  ) THEN
    RAISE EXCEPTION 'No orderable products';
  END IF;
END
$$;

UPDATE "AppSettings"
SET "cartEnabled" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'default';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AppSettings" WHERE "id" = 'default' AND "cartEnabled" = true
  ) THEN
    RAISE EXCEPTION 'Cart flag verification failed';
  END IF;
END
$$;

COMMIT;

SELECT
  (SELECT "cartEnabled" FROM "AppSettings" WHERE "id" = 'default') AS cart_enabled,
  (SELECT count(*) FROM "Manager" WHERE "isActive" = true) AS active_managers,
  count(*) FILTER (
    WHERE "isActive" = true
      AND "priceWithVat" > 0
      AND COALESCE("unitName", '') <> ''
      AND COALESCE("packageType", '') <> ''
      AND "unitsPerPackage" > 0
  ) AS orderable_products
FROM "Product";
SQL

echo '[3/3] Cart enabled'
echo "database_backup=$database_backup"
