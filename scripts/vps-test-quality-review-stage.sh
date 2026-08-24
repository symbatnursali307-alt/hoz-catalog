#!/usr/bin/env bash
set -Eeuo pipefail

base=http://127.0.0.1:3001
stage_env=/etc/katalog-hoz-quality-stage.env
admin_secret=$(sed -n 's/^ADMIN_SECRET=//p' "$stage_env")
test -n "$admin_secret"
work=$(mktemp -d /tmp/katalog-quality-test.XXXXXX)
trap 'rm -rf -- "$work"' EXIT

status=$(curl -sS -o "$work/unauthorized.json" -w '%{http_code}' "$base/api/admin/product-reviews")
test "$status" = 401

curl -fsS -H "x-admin-secret: $admin_secret" "$base/api/admin/product-reviews" > "$work/reviews.json"
python3 - "$work/reviews.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
assert data['stats']['totalProducts'] == 450, data['stats']
assert data['stats']['needsReview'] > 0, data['stats']
assert data['stats']['withErrors'] > 0, data['stats']
assert len(data['items']) == data['stats']['needsReview']
print('quality_stats=' + json.dumps(data['stats'], ensure_ascii=False, sort_keys=True))
PY

product_id=$(python3 - "$work/reviews.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1], encoding='utf-8'))['items'][0]['id'])
PY
)
test -n "$product_id"

python3 - "$product_id" > "$work/mark.json" <<'PY'
import json, sys
print(json.dumps({'productId': sys.argv[1], 'note': 'Staging: проверка ручной очереди'}))
PY
curl -fsS -H "x-admin-secret: $admin_secret" -H 'Content-Type: application/json' --data-binary "@$work/mark.json" "$base/api/admin/product-reviews" > "$work/created.json"
review_id=$(python3 - "$work/created.json" <<'PY'
import json, sys
data=json.load(open(sys.argv[1], encoding='utf-8'))
assert data['success'] is True
print(data['review']['id'])
PY
)
test -n "$review_id"

curl -fsS -X PATCH -H "x-admin-secret: $admin_secret" -H 'Content-Type: application/json' --data '{"action":"resolve"}' "$base/api/admin/product-reviews/$review_id" > "$work/resolved.json"
python3 - "$work/resolved.json" <<'PY'
import json, sys
data=json.load(open(sys.argv[1], encoding='utf-8'))
assert data['success'] is True
assert data['review']['status'] == 'RESOLVED'
PY

test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/admin/product-review")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' -H "x-admin-secret: $admin_secret" "$base/api/admin/products")" = 200
echo 'quality_review_stage_test=ok'
