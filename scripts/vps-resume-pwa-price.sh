#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-pwa"
stage_db=kataloghoz_pwa_stage
stage_env=/etc/katalog-hoz-pwa-stage.env
archive=/home/ubuntu/katalog-pwa-stage.tar.gz
runner_dir=$(mktemp -d)

cleanup() {
  rm -rf -- "$runner_dir"
}
trap cleanup EXIT

test -d "$stage_dir/.next"
test -f "$stage_env"
test -f "$archive"

systemctl restart katalog-hoz-stage
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/manifest.webmanifest >/dev/null; then break; fi
  sleep 2
done
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/)" = 200

python3 - <<'PY'
import json
import urllib.request

base = 'http://127.0.0.1:3001'
for path in ['/pwa-boot.js', '/sw.js', '/manifest.webmanifest', '/offline']:
    with urllib.request.urlopen(base + path) as response:
        assert response.status == 200, path
with urllib.request.urlopen(base + '/pwa-boot.js') as response:
    assert "addEventListener('beforeinstallprompt'" in response.read().decode('utf-8')
with urllib.request.urlopen(base + '/api/products?limit=100') as response:
    products = json.load(response)['items']
assert products
assert all(item['priceWithVat'] is None or float(item['priceWithVat']).is_integer() for item in products)
print('stage_resume_http=ok')
PY

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$stage_db" -At <<'SQL' > /tmp/katalog-pwa-resume-counts.txt
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
cat /tmp/katalog-pwa-resume-counts.txt
grep -qx 'products=450' /tmp/katalog-pwa-resume-counts.txt
grep -qx 'reviews=366' /tmp/katalog-pwa-resume-counts.txt
grep -qx 'fractional_prices=0' /tmp/katalog-pwa-resume-counts.txt
rm -f -- /tmp/katalog-pwa-resume-counts.txt

tar -xzf "$archive" -C "$runner_dir" ./scripts/vps-promote-pwa-reminder.sh
bash -n "$runner_dir/scripts/vps-promote-pwa-reminder.sh"
bash "$runner_dir/scripts/vps-promote-pwa-reminder.sh"
