#!/usr/bin/env bash
set -Eeuo pipefail

base=http://127.0.0.1:3000
source /root/katalog-hoz-secrets.env
set -a
source /etc/katalog-hoz.env
set +a

echo '[1/5] Public and safety checks'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/catalog")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/m/a")" = 307
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/meta-feed.csv")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/debug")" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/admin/reports")" = 401
curl -fsS "$base/api/catalog-config" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["cartEnabled"] is False; assert len(d["managers"])==1 and d["managers"][0]["slug"]=="a"'
curl -fsS "$base/api/products?limit=2&offset=0" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["total"]==450 and len(d["items"])==2'
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$base/api/cart-submissions")" = 503

echo '[2/5] Admin login and protected API checks'
login_payload=$(python3 -c 'import json,os; print(json.dumps({"login":os.environ["ADMIN_LOGIN"],"password":os.environ["ADMIN_PASSWORD"]}))')
cookie_file=$(mktemp)
chmod 600 "$cookie_file"
curl -fsS -c "$cookie_file" -H 'Content-Type: application/json' --data "$login_payload" "$base/api/admin/login" >/dev/null
test "$(curl -sS -b "$cookie_file" -o /dev/null -w '%{http_code}' "$base/api/admin/reports")" = 200
test "$(curl -sS -b "$cookie_file" -o /dev/null -w '%{http_code}' "$base/api/admin/cart-submissions")" = 200
test "$(curl -sS -b "$cookie_file" -o /dev/null -w '%{http_code}' "$base/api/admin/export/products?format=xls")" = 200
rm -f -- "$cookie_file"

echo '[3/5] Test analytics storage and cleanup'
event_id="prod-smoke-$(date +%s)"
payload="{\"eventName\":\"catalog_opened\",\"eventId\":\"$event_id\",\"visitorId\":\"prod-smoke\",\"sessionId\":\"prod-smoke\",\"isTest\":true}"
curl -fsS -H 'Content-Type: application/json' --data "$payload" "$base/api/analytics" >/dev/null
test "$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -Atc "SELECT count(*) FROM \"AnalyticsEvent\" WHERE \"eventId\"='$event_id' AND \"isTest\"=true")" = 1
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -c "DELETE FROM \"AnalyticsEvent\" WHERE \"eventId\"='$event_id'" >/dev/null

echo '[4/5] Reporting real data gaps without inventing packaging'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -At <<'SQL'
SELECT 'missing_price_with_vat=' || count(*) FROM "Product" WHERE "priceWithVat" IS NULL OR "priceWithVat" <= 0;
SELECT 'missing_unit_name=' || count(*) FROM "Product" WHERE NULLIF(BTRIM(COALESCE("unitName",'')),'') IS NULL;
SELECT 'missing_package_type=' || count(*) FROM "Product" WHERE NULLIF(BTRIM(COALESCE("packageType",'')),'') IS NULL;
SELECT 'missing_units_per_package=' || count(*) FROM "Product" WHERE "unitsPerPackage" IS NULL OR "unitsPerPackage" <= 0;
SELECT 'orderable_products=' || count(*) FROM "Product" WHERE "isActive"=true AND "priceWithVat">0 AND NULLIF(BTRIM(COALESCE("unitName",'')),'') IS NOT NULL AND NULLIF(BTRIM(COALESCE("packageType",'')),'') IS NOT NULL AND "unitsPerPackage">0;
SQL

echo '[5/5] Services and HTTPS'
test "$(systemctl is-active katalog-hoz)" = active
test "$(systemctl is-active nginx)" = active
test "$(systemctl is-active postgresql)" = active
test "$(systemctl is-active katalog-hoz-backup.timer)" = active
test "$(systemctl is-active certbot.timer)" = active
test "$(curl -sS -L -o /dev/null -w '%{http_code}' https://catalog.almatytovar.kz/)" = 200
echo 'PRODUCTION_B2B_HEALTH=PASS'
