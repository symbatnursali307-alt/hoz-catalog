#!/usr/bin/env bash
set -Eeuo pipefail

stage_db=kataloghoz_b2b_stage
base=http://127.0.0.1:3001
stage_env=/etc/katalog-hoz-stage.env
response=/tmp/katalog-hoz-stage-submission.json

set -a
source "$stage_env"
set +a

# The staging service normally ignores localhost diagnostics. Functional test
# events carry isTest=true instead, so temporarily allow them to reach storage.
sed -i '/^ANALYTICS_EXCLUDED_IPS=/d' "$stage_env"
systemctl restart katalog-hoz-stage
for _ in $(seq 1 20); do
  if curl -fsS "$base/api/catalog-config" >/dev/null; then break; fi
  sleep 1
done

echo '[1/6] Preparing test-only product and second manager in staging'
runuser -u postgres -- psql -d "$stage_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DELETE FROM "AnalyticsEvent" WHERE "visitorId"='stage-visitor';
DELETE FROM "CartSubmission" WHERE "visitorId"='stage-visitor';
SQL
product_id=$(runuser -u postgres -- psql -d "$stage_db" -At -v ON_ERROR_STOP=1 <<'SQL'
WITH picked AS (
  SELECT id FROM "Product" ORDER BY "sortOrder", id LIMIT 1
), updated AS (
  UPDATE "Product" product
  SET "priceWithVat"=10, "unitName"='шт', unit='шт', "packageType"='коробка',
      "unitsPerPackage"=12, "packageQuantity"=12, "packageUnit"='шт',
      "minOrderPackages"=2, "isActive"=true
  FROM picked WHERE product.id=picked.id RETURNING product.id
)
SELECT id FROM updated;
SQL
)
test -n "$product_id"
runuser -u postgres -- psql -d "$stage_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO "Manager" (id,name,slug,"whatsappPhone","isActive","isDefault","createdAt","updatedAt")
VALUES ('manager-stage-b','Тестовый менеджер B','b','70000000002',true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO UPDATE SET "isActive"=true;
UPDATE "AppSettings" SET "cartEnabled"=true WHERE id='default';
SQL

echo '[2/6] Verifying public catalog, manager routing and feed'
curl -fsS "$base/api/catalog-config" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["cartEnabled"] is True; assert any(x["slug"]=="b" for x in d["managers"])'
curl -fsS "$base/api/products?limit=500&offset=0" | PRODUCT_ID="$product_id" python3 -c 'import json,os,sys; d=json.load(sys.stdin); p=next(x for x in d["items"] if x["id"]==os.environ["PRODUCT_ID"]); assert p["orderable"] is True and p["packagePrice"]==120 and p["minOrderPackages"]==2'
feed_lines=$(curl -fsS "$base/api/meta-feed.csv" | grep -c '^')
test "$feed_lines" -ge 2
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/m/a")" = 307
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/m/b")" = 307

echo '[3/6] Verifying test analytics event and deduplication'
event='{"eventName":"product_viewed","eventId":"stage-event-1","visitorId":"stage-visitor","sessionId":"stage-session","productId":"PRODUCT_ID","contentIds":["stage-product"],"isTest":true}'
event=${event/PRODUCT_ID/$product_id}
curl -fsS -H 'Content-Type: application/json' --data "$event" "$base/api/analytics" >/dev/null
curl -fsS -H 'Content-Type: application/json' --data "$event" "$base/api/analytics" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("duplicate") is True'
test "$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT count(*) FROM \"AnalyticsEvent\" WHERE \"eventId\"='stage-event-1' AND \"isTest\"=true")" = 1

echo '[4/6] Verifying package totals, snapshot and manager B WhatsApp URL'
payload='{"visitorId":"stage-visitor","sessionId":"stage-session","managerSlug":"b","phone":"77000000001","customerName":"Stage test","items":[{"id":"PRODUCT_ID","packageQuantity":2}],"utm":{"source":"stage"}}'
payload=${payload/PRODUCT_ID/$product_id}
curl -fsS -H 'Content-Type: application/json' --data "$payload" "$base/api/cart-submissions" > "$response"
python3 - "$response" <<'PY'
import json,sys
data=json.load(open(sys.argv[1],encoding='utf-8'))
assert data['success'] is True
assert data['totalAmount'] == 240
assert data['manager']['slug'] == 'b'
assert data['whatsappUrl'].startswith('https://wa.me/70000000002?text=')
PY

minimum_payload='{"visitorId":"stage-visitor","sessionId":"stage-minimum","managerSlug":"b","phone":"77000000001","items":[{"id":"PRODUCT_ID","packageQuantity":1}]}'
minimum_payload=${minimum_payload/PRODUCT_ID/$product_id}
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data "$minimum_payload" "$base/api/cart-submissions")" = 409

default_payload='{"visitorId":"stage-visitor","sessionId":"stage-default","phone":"77000000001","items":[{"id":"PRODUCT_ID","packageQuantity":2}]}'
default_payload=${default_payload/PRODUCT_ID/$product_id}
curl -fsS -H 'Content-Type: application/json' --data "$default_payload" "$base/api/cart-submissions" > "$response"
default_phone=$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT \"whatsappPhone\" FROM \"Manager\" WHERE \"isDefault\"=true AND \"isActive\"=true LIMIT 1")
DEFAULT_PHONE="$default_phone" python3 - "$response" <<'PY'
import json,os,sys
data=json.load(open(sys.argv[1],encoding='utf-8'))
assert data['manager']['slug'] == 'a'
assert data['whatsappUrl'].startswith('https://wa.me/'+os.environ['DEFAULT_PHONE']+'?text=')
PY
runuser -u postgres -- psql -d "$stage_db" -At -v ON_ERROR_STOP=1 <<'SQL' | grep -qx '1|240|2|240'
SELECT count(*) || '|' || max("totalAmount")::int || '|' || max((items->0->>'packageQuantity')::int) || '|' || max((items->0->>'lineTotal')::numeric)::int
FROM "CartSubmission" WHERE "sessionId"='stage-session';
SQL

echo '[5/6] Verifying admin protection and reports'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/admin/reports")" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' -H "x-admin-secret: $ADMIN_SECRET" "$base/api/admin/reports")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' -H "x-admin-secret: $ADMIN_SECRET" "$base/api/admin/export/products?format=csv")" = 200
product_slug=$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT slug FROM \"Product\" WHERE id='$product_id'")
test "$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H "x-admin-secret: $ADMIN_SECRET" -H 'Content-Type: application/json' --data '{"isActive":false}' "$base/api/admin/products/$product_id")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/products/$product_slug")" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H "x-admin-secret: $ADMIN_SECRET" -H 'Content-Type: application/json' --data '{"isActive":true}' "$base/api/admin/products/$product_id")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/products/$product_slug")" = 200

echo '[6/6] Production isolation check'
test "$(systemctl is-active katalog-hoz)" = active
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)" = 200
rm -f -- "$response"
echo 'B2B_STAGE_TESTS=PASS'
