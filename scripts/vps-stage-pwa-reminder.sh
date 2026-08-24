#!/usr/bin/env bash
set -Eeuo pipefail

archive=/home/ubuntu/katalog-pwa-stage.tar.gz
expected_archive_sha256=${1:?Pass the expected archive SHA-256 as the first argument}
app_root=/srv/katalog-hoz
stage_db=kataloghoz_pwa_stage
stage_dir="$app_root/staging-pwa"
stage_env=/etc/katalog-hoz-pwa-stage.env

test -f "$archive"
echo "$expected_archive_sha256  $archive" | sha256sum -c -
test -f /etc/katalog-hoz.env
test "$stage_dir" = /srv/katalog-hoz/staging-pwa

echo '[1/8] Cloning production into an isolated staging database'
systemctl stop katalog-hoz-stage 2>/dev/null || true
runuser -u postgres -- dropdb --if-exists --force "$stage_db"
runuser -u postgres -- createdb --owner=kataloghoz "$stage_db"
runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl kataloghoz \
  | runuser -u postgres -- pg_restore --exit-on-error --no-owner --role=kataloghoz --dbname="$stage_db"

echo '[2/8] Extracting the candidate release'
rm -rf -- "$stage_dir"
install -d -o kataloghoz -g kataloghoz "$stage_dir"
tar -xzf "$archive" -C "$stage_dir"
chown -R kataloghoz:kataloghoz "$stage_dir"
test -f "$stage_dir/public/sw.js"
test -f "$stage_dir/public/pwa-icon-192.png"
test -f "$stage_dir/public/pwa-icon-512.png"
test -f "$stage_dir/scripts/test-pwa-install.ts"
test -f "$stage_dir/public/pwa-boot.js"
grep -q 'PwaInstallButton' "$stage_dir/app/page.tsx"
grep -q 'PwaInstallButton' "$stage_dir/app/admin/layout.tsx"

echo '[3/8] Preparing the isolated environment'
db_password=$(sed -n 's/^DB_PASSWORD=//p' /root/katalog-hoz-secrets.env)
test -n "$db_password"
install -o root -g kataloghoz -m 640 /dev/null "$stage_env"
awk -F= '!/^DATABASE_URL=|^PORT=|^SITE_URL=|^META_|^NEXT_PUBLIC_META_/ { print }' /etc/katalog-hoz.env > "$stage_env"
{
  echo "DATABASE_URL=postgresql://kataloghoz:${db_password}@127.0.0.1:5432/${stage_db}?schema=public"
  echo 'PORT=3001'
  echo 'SITE_URL=https://catalog.almatytovar.kz'
  echo 'ANALYTICS_EXCLUDED_IPS=127.0.0.2'
  echo 'NEXT_TELEMETRY_DISABLED=1'
} >> "$stage_env"
chown root:kataloghoz "$stage_env"
chmod 640 "$stage_env"

echo '[4/8] Installing, testing, migrating and building staging'
runuser -u kataloghoz -- /bin/bash -s -- "$stage_dir" "$stage_env" <<'APP'
set -Eeuo pipefail
release_dir=$1
environment=$2
set -a
source "$environment"
set +a
cd "$release_dir"
npm ci --no-audit --no-fund
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
npm run test:packaging
npm run test:quality
npm run test:pwa
npm run test:pricing
npm run generate:pwa-icons
npm run build
APP

echo '[5/8] Verifying cloned production data is unchanged'
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$stage_db" -At <<'SQL' > /tmp/katalog-pwa-counts.txt
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'characteristics=' || count(*) FROM "Product" WHERE characteristics IS NOT NULL;
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
cat /tmp/katalog-pwa-counts.txt
grep -qx 'products=450' /tmp/katalog-pwa-counts.txt
grep -qx 'reviews=366' /tmp/katalog-pwa-counts.txt
grep -qx 'characteristics=445' /tmp/katalog-pwa-counts.txt
grep -qx 'cart_enabled=true' /tmp/katalog-pwa-counts.txt
grep -qx 'fractional_prices=0' /tmp/katalog-pwa-counts.txt
rm -f -- /tmp/katalog-pwa-counts.txt

echo '[6/8] Starting the candidate on 127.0.0.1:3001'
cat > /etc/systemd/system/katalog-hoz-stage.service <<SYSTEMD
[Unit]
Description=Katalog Hoz PWA staging
After=network-online.target postgresql.service

[Service]
Type=simple
User=kataloghoz
Group=kataloghoz
WorkingDirectory=$stage_dir
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=$stage_env
ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
SYSTEMD
systemctl daemon-reload
systemctl restart katalog-hoz-stage
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/manifest.webmanifest >/dev/null; then break; fi
  sleep 2
done

echo '[7/8] Verifying manifest, worker, offline page and icons'
python3 - <<'PY'
import json
import urllib.request

base = 'http://127.0.0.1:3001'
with urllib.request.urlopen(base + '/manifest.webmanifest') as response:
    assert response.status == 200
    assert response.headers.get_content_type() == 'application/manifest+json'
    manifest = json.load(response)
assert manifest['name'] == 'Алматы Товар'
assert manifest['short_name'] == 'Хозтовары'
assert manifest['display'] == 'standalone'
assert manifest['start_url'] == '/'
assert {icon['sizes'] for icon in manifest['icons']} == {'192x192', '512x512'}
for path in ['/pwa-boot.js', '/sw.js', '/offline', '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png']:
    with urllib.request.urlopen(base + path) as response:
        assert response.status == 200, path
with urllib.request.urlopen(base + '/sw.js') as response:
    worker = response.read().decode('utf-8')
assert "addEventListener('fetch'" in worker
with urllib.request.urlopen(base + '/pwa-boot.js') as response:
    boot = response.read().decode('utf-8')
assert "addEventListener('beforeinstallprompt'" in boot
print('pwa_http=ok')
PY

echo '[8/8] Verifying all four PWA analytics events'
for event_name in \
  pwa_install_prompt_shown \
  pwa_install_clicked \
  pwa_install_dismissed \
  pwa_install_remind_later
do
  status=$(curl -sS -o /tmp/katalog-pwa-analytics.json -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -H 'Referer: https://catalog.almatytovar.kz/' \
    -H 'User-Agent: KatalogPwaReleaseCheck/1.0' \
    --data "{\"eventName\":\"$event_name\",\"eventId\":\"stage-$event_name-$(date +%s%N)\",\"visitorId\":\"stage-pwa-visitor\",\"sessionId\":\"stage-pwa-session\",\"isTest\":true,\"metadata\":{\"source\":\"release_check\"}}" \
    http://127.0.0.1:3001/api/analytics)
  test "$status" = 201
done
rm -f -- /tmp/katalog-pwa-analytics.json
echo "stage_service=$(systemctl is-active katalog-hoz-stage)"
echo "stage_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/)"
echo "production_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
