#!/usr/bin/env bash
set -Eeuo pipefail

catalog=https://catalog.almatytovar.kz
main=https://almatytovar.kz

echo '[1/5] DNS and certificate'
getent ahostsv4 catalog.almatytovar.kz | awk '{print $1}' | grep -qx 46.247.41.103
openssl s_client -connect catalog.almatytovar.kz:443 -servername catalog.almatytovar.kz </dev/null 2>/dev/null \
  | openssl x509 -noout -checkhost catalog.almatytovar.kz | grep -q 'does match certificate'

echo '[2/5] Catalog and admin routes'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/catalog")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/admin/login")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/admin/product-review")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/api/debug")" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' "$catalog/api/admin/product-reviews")" = 401

echo '[3/5] Public APIs and catalog links'
curl -fsS "$catalog/api/catalog-config" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["cartEnabled"] is True; assert len(d["managers"]) >= 1'
curl -fsS "$catalog/api/products?limit=2&offset=0" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["total"] == 450; assert len(d["items"]) == 2'
curl -fsS "$catalog/api/meta-feed.csv" > /tmp/katalog-domain-feed.csv
grep -q 'https://catalog.almatytovar.kz' /tmp/katalog-domain-feed.csv
if grep -q 'https://almatytovar.kz' /tmp/katalog-domain-feed.csv; then
  echo 'Old main-domain links remain in Meta feed' >&2
  exit 1
fi
rm -f -- /tmp/katalog-domain-feed.csv

echo '[4/5] Main-domain continuity and redirects'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$main/")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' http://catalog.almatytovar.kz/)" = 301
test "$(curl -sS -o /dev/null -w '%{redirect_url}' http://catalog.almatytovar.kz/)" = 'https://catalog.almatytovar.kz/'

echo '[5/5] Runtime and services'
grep -qx 'SITE_URL=https://catalog.almatytovar.kz' /etc/katalog-hoz.env
test "$(systemctl is-active katalog-hoz)" = active
test "$(systemctl is-active nginx)" = active
test "$(systemctl is-active certbot.timer)" = active
echo 'CATALOG_DOMAIN_HEALTH=PASS'
