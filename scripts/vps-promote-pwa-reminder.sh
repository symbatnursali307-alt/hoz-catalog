#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-pwa"
stage_db=kataloghoz_pwa_stage
release_id="pwa-price-rounding-$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
runtime_env=/etc/katalog-hoz.env
stage_env=/etc/katalog-hoz-pwa-stage.env
backup_dir="$app_root/shared/backups"
source_archive=/home/ubuntu/katalog-pwa-stage.tar.gz
old_release=$(readlink -f "$app_root/current")

test -d "$stage_dir/.next"
test -f "$stage_dir/public/sw.js"
test -f "$stage_dir/public/pwa-icon-512.png"
test -f "$runtime_env"
test -n "$old_release"
source /root/katalog-hoz-secrets.env

rollback_app() {
  if [[ -n "${old_release:-}" && -d "$old_release" ]]; then
    ln -sfn "$old_release" "$app_root/current"
    systemctl restart katalog-hoz || true
  fi
}
trap 'echo "Promotion failed; restoring previous application release" >&2; rollback_app' ERR

echo '[1/7] Creating and validating a pre-release database backup'
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
pre_backup="$backup_dir/postgresql-pre-pwa-price-rounding-$timestamp.dump"
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$pre_backup"
pg_restore --list "$pre_backup" >/dev/null
sha256sum "$pre_backup" > "$pre_backup.sha256"

echo '[2/7] Promoting the staging-tested build'
systemctl stop katalog-hoz-stage
mv -- "$stage_dir" "$release_dir"
chown -R kataloghoz:kataloghoz "$release_dir"

echo '[3/7] Confirming the production schema and protected data'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP'
set -Eeuo pipefail
release_dir=$1
set -a
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
APP

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -At -v ON_ERROR_STOP=1 <<'SQL' > /tmp/katalog-pwa-production-counts.txt
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'characteristics=' || count(*) FROM "Product" WHERE characteristics IS NOT NULL;
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
cat /tmp/katalog-pwa-production-counts.txt
grep -qx 'products=450' /tmp/katalog-pwa-production-counts.txt
grep -qx 'reviews=366' /tmp/katalog-pwa-production-counts.txt
grep -qx 'characteristics=445' /tmp/katalog-pwa-production-counts.txt
grep -qx 'cart_enabled=true' /tmp/katalog-pwa-production-counts.txt
grep -qx 'fractional_prices=0' /tmp/katalog-pwa-production-counts.txt
rm -f -- /tmp/katalog-pwa-production-counts.txt

echo '[4/7] Switching the application release'
ln -sfn "$release_dir" "$app_root/current"
systemctl restart katalog-hoz
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/manifest.webmanifest >/dev/null; then break; fi
  sleep 2
done

echo '[5/7] Verifying the production PWA surface'
python3 - <<'PY'
import json
import urllib.request

base = 'http://127.0.0.1:3000'
with urllib.request.urlopen(base + '/manifest.webmanifest') as response:
    manifest = json.load(response)
assert manifest['name'] == 'Алматы Товар'
assert manifest['display'] == 'standalone'
assert manifest['start_url'] == '/'
for path in ['/', '/pwa-boot.js', '/sw.js', '/offline', '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png']:
    with urllib.request.urlopen(base + path) as response:
        assert response.status == 200, path
with urllib.request.urlopen(base + '/sw.js') as response:
    assert "addEventListener('fetch'" in response.read().decode('utf-8')
print('production_pwa_http=ok')
PY
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/debug)" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/admin/product-reviews)" = 401

echo '[6/7] Creating and validating the post-release database backup'
post_backup="$backup_dir/postgresql-post-pwa-price-rounding-$timestamp.dump"
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$post_backup"
pg_restore --list "$post_backup" >/dev/null
sha256sum "$post_backup" > "$post_backup.sha256"

echo '[7/7] Preserving source and cleaning isolated staging resources'
install -o root -g root -m 600 "$source_archive" "$backup_dir/katalog-source-$release_id.tar.gz"
runuser -u postgres -- dropdb --if-exists --force "$stage_db"
rm -f -- "$stage_env" "$source_archive"
systemctl disable katalog-hoz-stage >/dev/null 2>&1 || true
rm -f -- /etc/systemd/system/katalog-hoz-stage.service
systemctl daemon-reload

echo "release=$release_id"
echo "previous_release=$old_release"
echo "pre_backup=$pre_backup"
echo "post_backup=$post_backup"
echo "service=$(systemctl is-active katalog-hoz)"
echo "http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
echo "manifest=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/manifest.webmanifest)"
echo "service_worker=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/sw.js)"
trap - ERR
