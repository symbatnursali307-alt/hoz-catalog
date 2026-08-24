#!/usr/bin/env bash
set -Eeuo pipefail

archive=/home/ubuntu/katalog-b2b-stage.tar.gz
app_root=/srv/katalog-hoz
stage_db=kataloghoz_b2b_stage
stage_dir="$app_root/staging-b2b"
stage_env=/etc/katalog-hoz-stage.env

test -f "$archive"
test -f /etc/katalog-hoz.env

echo '[1/7] Cloning production database into an isolated staging database'
systemctl stop katalog-hoz-stage 2>/dev/null || true
runuser -u postgres -- dropdb --if-exists --force "$stage_db"
runuser -u postgres -- createdb --owner=kataloghoz "$stage_db"
runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl kataloghoz | runuser -u postgres -- pg_restore --exit-on-error --no-owner --role=kataloghoz --dbname="$stage_db"

echo '[2/7] Extracting isolated staging release'
rm -rf -- "$stage_dir"
install -d -o kataloghoz -g kataloghoz "$stage_dir"
tar -xzf "$archive" -C "$stage_dir"
chown -R kataloghoz:kataloghoz "$stage_dir"

echo '[3/7] Preparing a staging-only environment'
db_password=$(sed -n 's/^DB_PASSWORD=//p' /root/katalog-hoz-secrets.env)
test -n "$db_password"
install -o root -g kataloghoz -m 640 /dev/null "$stage_env"
awk -F= '!/^DATABASE_URL=|^PORT=|^SITE_URL=|^META_|^NEXT_PUBLIC_META_/ { print }' /etc/katalog-hoz.env > "$stage_env"
{
  echo "DATABASE_URL=postgresql://kataloghoz:${db_password}@127.0.0.1:5432/${stage_db}?schema=public"
  echo 'PORT=3001'
  echo 'SITE_URL=https://catalog.almatytovar.kz'
  echo 'ANALYTICS_EXCLUDED_IPS=127.0.0.1'
  echo 'NEXT_TELEMETRY_DISABLED=1'
} >> "$stage_env"
chown root:kataloghoz "$stage_env"
chmod 640 "$stage_env"

echo '[4/7] Installing dependencies and marking the restored schema baseline'
runuser -u kataloghoz -- /bin/bash -s -- "$stage_dir" "$stage_env" <<'APP'
set -Eeuo pipefail
release_dir=$1
environment=$2
set -a
source "$environment"
set +a
cd "$release_dir"
npm ci --no-audit --no-fund
./node_modules/.bin/prisma migrate resolve --applied 20260820000000_baseline
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
npm run build
APP

echo '[5/7] Verifying migrated records and safety defaults'
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$stage_db" -At <<'SQL'
SELECT 'products=' || count(*) FROM "Product";
SELECT 'categories=' || count(*) FROM "Category";
SELECT 'managers=' || count(*) FROM "Manager";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'missing_slug=' || count(*) FROM "Product" WHERE slug IS NULL OR slug='';
SELECT 'duplicate_slug=' || count(*) FROM (SELECT slug FROM "Product" GROUP BY slug HAVING count(*) > 1) duplicate;
SQL

echo '[6/7] Starting the isolated application on 127.0.0.1:3001'
cat > /etc/systemd/system/katalog-hoz-stage.service <<SYSTEMD
[Unit]
Description=Katalog Hoz B2B staging verification
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
  if curl -fsS http://127.0.0.1:3001/api/catalog-config >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3001/api/catalog-config >/dev/null

echo '[7/7] Staging is ready'
echo "stage_service=$(systemctl is-active katalog-hoz-stage)"
echo "production_service=$(systemctl is-active katalog-hoz)"
echo "stage_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/)"
echo "production_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
