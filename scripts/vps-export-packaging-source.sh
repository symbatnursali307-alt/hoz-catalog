#!/usr/bin/env bash
set -Eeuo pipefail
source /root/katalog-hoz-secrets.env
target=/home/ubuntu/product-packaging-source.csv
rm -f -- "$target"
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -v ON_ERROR_STOP=1 <<SQL
\copy (SELECT "id", "externalId", "slug", "name", "description", "shortDescription", "fullDescription", "unit", "unitName", "packageType", "packageQuantity", "unitsPerPackage", "packageUnit", "priceWithVat", "isActive" FROM "Product" ORDER BY "sortOrder", "id") TO '$target' WITH (FORMAT CSV, HEADER true, ENCODING 'UTF8')
SQL
chown ubuntu:ubuntu "$target"
chmod 600 "$target"
echo "rows=$(($(wc -l < "$target") - 1))"
echo "bytes=$(stat -c %s "$target")"
