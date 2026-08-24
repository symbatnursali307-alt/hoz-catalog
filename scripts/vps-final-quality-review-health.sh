#!/usr/bin/env bash
set -Eeuo pipefail

base=http://127.0.0.1:3000
runtime_env=/etc/katalog-hoz.env
work=$(mktemp -d /tmp/katalog-quality-prod-test.XXXXXX)
review_id=''
test_note="Production smoke check $(date -u +%Y%m%dT%H%M%SZ)"

set -a
source /root/katalog-hoz-secrets.env
source "$runtime_env"
set +a

cleanup() {
  if [[ "$review_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz \
      -v ON_ERROR_STOP=1 \
      -c "DELETE FROM \"ProductReview\" WHERE id='$review_id' AND note='$test_note'" >/dev/null || true
  fi
  rm -rf -- "$work"
}
trap cleanup EXIT

echo '[1/5] Checking public and protected routes'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/admin/product-review")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/admin/product-reviews")" = 401
curl -fsS "$base/api/catalog-config" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["cartEnabled"] is True'

echo '[2/5] Verifying computed quality statistics'
curl -fsS -H "x-admin-secret: $ADMIN_SECRET" "$base/api/admin/product-reviews" > "$work/reviews.json"
python3 - "$work/reviews.json" <<'PY'
import json, sys

data = json.load(open(sys.argv[1], encoding='utf-8'))
expected = {
    'totalProducts': 450,
    'needsReview': 450,
    'withErrors': 99,
    'warningsOnly': 351,
    'manualPending': 0,
    'clean': 0,
}
assert data['stats'] == expected, data['stats']
assert len(data['items']) == expected['needsReview']
print('quality_stats=' + json.dumps(data['stats'], ensure_ascii=False, sort_keys=True))
PY

product_id=$(python3 - "$work/reviews.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1], encoding='utf-8'))['items'][0]['id'])
PY
)
[[ "$product_id" =~ ^[a-zA-Z0-9_-]+$ ]]

echo '[3/5] Creating a reversible manual review mark'
python3 - "$product_id" "$test_note" > "$work/mark.json" <<'PY'
import json, sys
print(json.dumps({'productId': sys.argv[1], 'note': sys.argv[2]}))
PY
curl -fsS -H "x-admin-secret: $ADMIN_SECRET" -H 'Content-Type: application/json' \
  --data-binary "@$work/mark.json" "$base/api/admin/product-reviews" > "$work/created.json"
review_id=$(python3 - "$work/created.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
assert data['success'] is True
assert data['review']['status'] == 'PENDING'
print(data['review']['id'])
PY
)
[[ "$review_id" =~ ^[a-zA-Z0-9_-]+$ ]]

echo '[4/5] Resolving the mark and removing the test row'
curl -fsS -X PATCH -H "x-admin-secret: $ADMIN_SECRET" -H 'Content-Type: application/json' \
  --data '{"action":"resolve"}' "$base/api/admin/product-reviews/$review_id" > "$work/resolved.json"
python3 - "$work/resolved.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
assert data['success'] is True
assert data['review']['status'] == 'RESOLVED'
PY
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz \
  -v ON_ERROR_STOP=1 \
  -c "DELETE FROM \"ProductReview\" WHERE id='$review_id' AND note='$test_note'" >/dev/null
review_id=''
test "$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -Atc 'SELECT count(*) FROM "ProductReview"')" = 0

echo '[5/5] Checking services and HTTPS'
test "$(systemctl is-active katalog-hoz)" = active
test "$(systemctl is-active nginx)" = active
test "$(systemctl is-active postgresql)" = active
test "$(curl -sS -L -o /dev/null -w '%{http_code}' https://catalog.almatytovar.kz/admin/product-review)" = 200
echo 'PRODUCTION_QUALITY_REVIEW_HEALTH=PASS'
