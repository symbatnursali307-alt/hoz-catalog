#!/usr/bin/env bash
set -Eeuo pipefail

patch_file=/home/ubuntu/cleaned-catalog-patch.json
source_file=/home/ubuntu/cleaned-catalog-source.xlsx
runner=/home/ubuntu/apply-cleaned-catalog.mjs
expected_patch_sha256=121b5a2a9975aa293a6355f97209c975aa821c065d5cc6199678d9bbee786805
expected_source_sha256=8a64bd12627090a0e64efe80a5d155b9cfab0ef8e2806f36fccf8c062fc5ddff
expected_runner_sha256=faad0f629ce563fd532d2048f9320caa1209cc4e11ca95154fd6e027597ccdd2
backup_dir=/srv/katalog-hoz/shared/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
pre_backup="$backup_dir/postgresql-pre-cleaned-catalog-$timestamp.dump"
post_backup="$backup_dir/postgresql-post-cleaned-catalog-$timestamp.dump"
review_output=/home/ubuntu/catalog-products-review-post-import.json

test -f "$patch_file"
test -f "$source_file"
test -f "$runner"
echo "$expected_patch_sha256  $patch_file" | sha256sum -c -
echo "$expected_source_sha256  $source_file" | sha256sum -c -
echo "$expected_runner_sha256  $runner" | sha256sum -c -

source /root/katalog-hoz-secrets.env

psql_catalog() {
  PGPASSWORD="$DB_PASSWORD" psql \
    -h 127.0.0.1 \
    -U kataloghoz \
    -d kataloghoz \
    -v ON_ERROR_STOP=1 \
    -Atqc "$1"
}

echo '[1/6] Capturing immutable pre-change checksums'
total_before=$(psql_catalog 'SELECT count(*) FROM "Product";')
test "$total_before" = 450
prices_before=$(psql_catalog 'SELECT md5(string_agg(COALESCE("externalId", id) || chr(31) || COALESCE("priceWithVat"::text, chr(30)), chr(29) ORDER BY COALESCE("externalId", id))) FROM "Product";')
active_before=$(psql_catalog 'SELECT md5(string_agg(COALESCE("externalId", id) || chr(31) || "isActive"::text, chr(29) ORDER BY COALESCE("externalId", id))) FROM "Product";')
omitted_before=$(psql_catalog "SELECT md5(string_agg(row_to_json(p)::text, chr(29) ORDER BY p.\"externalId\")) FROM \"Product\" p WHERE p.\"externalId\" IN ('WA1-0059', 'WA1-0060', 'WA2-0015', 'WA2-0048', 'WA2-0050');")
omitted_count=$(psql_catalog "SELECT count(*) FROM \"Product\" WHERE \"externalId\" IN ('WA1-0059', 'WA1-0060', 'WA2-0015', 'WA2-0048', 'WA2-0050');")
test "$omitted_count" = 5

echo '[2/6] Creating and validating the pre-change database backup'
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  --format=custom \
  --file="$pre_backup"
pg_restore --list "$pre_backup" >/dev/null
chmod 600 "$pre_backup"

install -o root -g root -m 600 "$source_file" "$backup_dir/cleaned-catalog-source-$timestamp.xlsx"
install -o root -g root -m 600 "$patch_file" "$backup_dir/cleaned-catalog-patch-$timestamp.json"
install -o root -g root -m 600 "$runner" "$backup_dir/apply-cleaned-catalog-$timestamp.mjs"

echo '[3/6] Applying 445 product updates and 366 review markers in one transaction'
set -a
source /etc/katalog-hoz.env
set +a
cd /srv/katalog-hoz/current
/usr/bin/node "$runner" --patch "$patch_file" --apply

echo '[4/6] Verifying protected values and row counts'
total_after=$(psql_catalog 'SELECT count(*) FROM "Product";')
prices_after=$(psql_catalog 'SELECT md5(string_agg(COALESCE("externalId", id) || chr(31) || COALESCE("priceWithVat"::text, chr(30)), chr(29) ORDER BY COALESCE("externalId", id))) FROM "Product";')
active_after=$(psql_catalog 'SELECT md5(string_agg(COALESCE("externalId", id) || chr(31) || "isActive"::text, chr(29) ORDER BY COALESCE("externalId", id))) FROM "Product";')
omitted_after=$(psql_catalog "SELECT md5(string_agg(row_to_json(p)::text, chr(29) ORDER BY p.\"externalId\")) FROM \"Product\" p WHERE p.\"externalId\" IN ('WA1-0059', 'WA1-0060', 'WA2-0015', 'WA2-0048', 'WA2-0050');")
characteristics_count=$(psql_catalog 'SELECT count(*) FROM "Product" WHERE characteristics IS NOT NULL;')
pending_reviews=$(psql_catalog "SELECT count(*) FROM \"ProductReview\" WHERE status = 'PENDING';")
test "$total_after" = 450
test "$prices_after" = "$prices_before"
test "$active_after" = "$active_before"
test "$omitted_after" = "$omitted_before"
test "$characteristics_count" = 445
test "$pending_reviews" = 366

echo '[5/6] Checking the live admin quality queue'
curl -fsS -H "x-admin-secret: $ADMIN_SECRET" \
  http://127.0.0.1:3000/api/admin/product-reviews \
  -o "$review_output"
python3 - "$review_output" <<'PY'
import collections
import json
import sys

data = json.load(open(sys.argv[1], encoding='utf-8'))
assert data['stats']['totalProducts'] == 450, data['stats']
assert data['stats']['manualPending'] == 366, data['stats']
codes = collections.Counter(
    issue['code']
    for item in data['items']
    for issue in item.get('issues', [])
)
print('stats=' + json.dumps(data['stats'], ensure_ascii=False, sort_keys=True))
print('issue_codes=' + json.dumps(codes, ensure_ascii=False, sort_keys=True))
PY
chown ubuntu:ubuntu "$review_output"
chmod 600 "$review_output"

echo '[6/6] Creating and validating the post-change database backup'
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  --format=custom \
  --file="$post_backup"
pg_restore --list "$post_backup" >/dev/null
chmod 600 "$post_backup"

echo "pre_backup=$pre_backup"
echo "post_backup=$post_backup"
echo "review_output=$review_output"
echo "total_products=$total_after"
echo "characteristics=$characteristics_count"
echo "pending_reviews=$pending_reviews"
echo "prices_unchanged=yes"
echo "active_states_unchanged=yes"
echo "omitted_products_unchanged=yes"
