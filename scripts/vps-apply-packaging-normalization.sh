#!/usr/bin/env bash
set -Eeuo pipefail

source /root/katalog-hoz-secrets.env

updates=/home/ubuntu/packaging-updates.csv
backup_dir=/srv/katalog-hoz/shared/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database_backup="$backup_dir/postgresql-pre-packaging-$timestamp.dump"
audit_copy="$backup_dir/packaging-updates-$timestamp.csv"
expected_sha256=4884e95ecd5a1c2a8a04381008b940fb3ae09c93e8995e554f0cedf7fe1ddf33

test -f "$updates"
echo "$expected_sha256  $updates" | sha256sum -c -

echo '[1/4] Creating and validating a pre-change PostgreSQL backup'
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  --format=custom \
  --file="$database_backup"
pg_restore --list "$database_backup" >/dev/null
chmod 600 "$database_backup"
install -o root -g root -m 600 "$updates" "$audit_copy"

echo '[2/4] Applying 360 audited updates in one transaction'
PGPASSWORD="$DB_PASSWORD" psql \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  -v ON_ERROR_STOP=1 <<'SQL'
SET lock_timeout = '5s';
SET statement_timeout = '60s';
BEGIN;

CREATE TEMP TABLE packaging_updates (
  id text,
  expected_name text,
  expected_description text,
  expected_unit_name text,
  expected_package_type text,
  expected_package_quantity text,
  expected_units_per_package text,
  expected_package_unit text,
  proposed_unit_name text,
  proposed_package_type text,
  proposed_units_per_package integer,
  proposed_package_unit text,
  evidence text
) ON COMMIT DROP;

\copy packaging_updates FROM '/home/ubuntu/packaging-updates.csv' WITH (FORMAT CSV, HEADER true, ENCODING 'UTF8')

DO $$
BEGIN
  IF (SELECT count(*) FROM packaging_updates) <> 360 THEN
    RAISE EXCEPTION 'Expected 360 update rows';
  END IF;

  IF (SELECT count(DISTINCT id) FROM packaging_updates) <> 360 THEN
    RAISE EXCEPTION 'Update file contains duplicate product IDs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM packaging_updates u
    LEFT JOIN "Product" p ON p."id" = u.id
    WHERE p."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more target products no longer exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM packaging_updates u
    JOIN "Product" p ON p."id" = u.id
    WHERE p."name" <> u.expected_name
       OR COALESCE(p."description", '') <> COALESCE(u.expected_description, '')
       OR COALESCE(p."unitName", '') <> COALESCE(u.expected_unit_name, '')
       OR COALESCE(p."packageType", '') <> COALESCE(u.expected_package_type, '')
       OR COALESCE(p."packageQuantity"::text, '') <> COALESCE(u.expected_package_quantity, '')
       OR COALESCE(p."unitsPerPackage"::text, '') <> COALESCE(u.expected_units_per_package, '')
       OR COALESCE(p."packageUnit", '') <> COALESCE(u.expected_package_unit, '')
  ) THEN
    RAISE EXCEPTION 'Production data changed after the audit export; refusing stale update';
  END IF;
END
$$;

UPDATE "Product" p
SET
  "unitName" = u.proposed_unit_name,
  "packageType" = u.proposed_package_type,
  "packageQuantity" = u.proposed_units_per_package,
  "unitsPerPackage" = u.proposed_units_per_package,
  "packageUnit" = u.proposed_package_unit,
  "updatedAt" = CURRENT_TIMESTAMP
FROM packaging_updates u
WHERE p."id" = u.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM packaging_updates u
    JOIN "Product" p ON p."id" = u.id
    WHERE p."unitName" <> u.proposed_unit_name
       OR p."packageType" <> u.proposed_package_type
       OR p."packageQuantity" <> u.proposed_units_per_package
       OR p."unitsPerPackage" <> u.proposed_units_per_package
       OR p."packageUnit" <> u.proposed_package_unit
  ) THEN
    RAISE EXCEPTION 'Post-update verification failed';
  END IF;
END
$$;

COMMIT;
SQL

echo '[3/4] Verifying catalog totals and the 780-pair example'
PGPASSWORD="$DB_PASSWORD" psql \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  -v ON_ERROR_STOP=1 \
  -P pager=off <<'SQL'
SELECT
  count(*) AS total_products,
  count(*) FILTER (WHERE "unitsPerPackage" > 0) AS normalized_products,
  count(*) FILTER (
    WHERE "isActive" = true
      AND "priceWithVat" > 0
      AND COALESCE("unitName", '') <> ''
      AND COALESCE("packageType", '') <> ''
      AND "unitsPerPackage" > 0
  ) AS orderable_products
FROM "Product";

SELECT
  "name",
  "priceWithVat" AS unit_price,
  "unitsPerPackage" AS units_in_package,
  "packageType",
  "packageUnit",
  ROUND(("priceWithVat" * "unitsPerPackage")::numeric, 2) AS package_price
FROM "Product"
WHERE "description" = 'В мешке 780пар'
ORDER BY "priceWithVat"
LIMIT 5;

SELECT "cartEnabled" FROM "AppSettings" LIMIT 1;
SQL

echo '[4/4] Packaging normalization completed'
echo "database_backup=$database_backup"
echo "audit_copy=$audit_copy"
