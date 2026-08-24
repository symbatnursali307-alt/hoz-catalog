#!/usr/bin/env bash
set -euo pipefail

transfer_dir=/home/ubuntu/katalog-transfer
app_root=/srv/katalog-hoz
release_id="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
secrets_file=/root/katalog-hoz-secrets.env
runtime_env=/etc/katalog-hoz.env

echo '[1/10] Verifying transfer checksums'
cd "$transfer_dir"
echo 'a9c8e373a9868bada568380be2ad1450f328393a7f50f71f124a180126d60a7b  katalog-source.tar.gz' | sha256sum -c -
echo '01f667766ffb7d3782b3d809a1b02c7203617575409ee15a0b3911caf889fb8b  vercel-blob-objects.tar' | sha256sum -c -
echo 'bbbe902afb91554865bfa99fdefc4028d78bf2e9614fc85acb9b38bb3dbb2749  data.sql' | sha256sum -c -

echo '[2/10] Creating production secrets and PostgreSQL database'
if [[ ! -f "$secrets_file" ]]; then
  umask 077
  {
    echo "DB_PASSWORD=$(openssl rand -hex 24)"
    echo "ADMIN_LOGIN=admin"
    echo "ADMIN_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9_-')"
    echo "ADMIN_SECRET=$(openssl rand -hex 48)"
  } > "$secrets_file"
fi
chmod 600 "$secrets_file"
# shellcheck disable=SC1090
source "$secrets_file"

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='kataloghoz'" | grep -qx 1; then
  runuser -u postgres -- psql <<SQL
CREATE ROLE kataloghoz LOGIN PASSWORD '$DB_PASSWORD';
SQL
else
  runuser -u postgres -- psql <<SQL
ALTER ROLE kataloghoz PASSWORD '$DB_PASSWORD';
SQL
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='kataloghoz'" | grep -qx 1; then
  runuser -u postgres -- createdb --owner=kataloghoz kataloghoz
fi

install -o root -g kataloghoz -m 640 /dev/null "$runtime_env"
cat > "$runtime_env" <<ENV
DATABASE_URL=postgresql://kataloghoz:${DB_PASSWORD}@127.0.0.1:5432/kataloghoz?schema=public
ADMIN_LOGIN=${ADMIN_LOGIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SECRET=${ADMIN_SECRET}
WHATSAPP_PHONE=77773042030
UPLOAD_DIR=/srv/katalog-hoz/shared/uploads
NEXT_TELEMETRY_DISABLED=1
ENV
chown root:kataloghoz "$runtime_env"
chmod 640 "$runtime_env"

echo '[3/10] Extracting source release and recovered images'
install -d -o kataloghoz -g kataloghoz "$release_dir"
tar -xzf "$transfer_dir/katalog-source.tar.gz" -C "$release_dir"
tar -xf "$transfer_dir/vercel-blob-objects.tar" -C "$app_root/shared/uploads"
chown -R kataloghoz:kataloghoz "$release_dir" "$app_root/shared/uploads"

echo '[4/10] Installing Node dependencies and applying the Prisma schema'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP_SETUP'
set -euo pipefail
release_dir=$1
set -a
# shellcheck disable=SC1091
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
npm ci --no-audit --no-fund
./node_modules/.bin/prisma db push
APP_SETUP

echo '[5/10] Restoring Neon data into local PostgreSQL'
table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('AppSettings','Category','Subcategory','Product','Client','ClientSelectedProduct')")
row_count=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -tAc \
  'SELECT (SELECT count(*) FROM "AppSettings") + (SELECT count(*) FROM "Category") + (SELECT count(*) FROM "Subcategory") + (SELECT count(*) FROM "Product") + (SELECT count(*) FROM "Client") + (SELECT count(*) FROM "ClientSelectedProduct")')
if [[ "$table_count" != 6 ]]; then
  echo "Expected 6 application tables, got $table_count" >&2
  exit 1
fi
if [[ "$row_count" == 0 ]]; then
  PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz \
    -v ON_ERROR_STOP=1 -f "$transfer_dir/data.sql"
elif [[ "$row_count" != 492 ]]; then
  echo "Refusing to restore over a non-empty database with $row_count rows" >&2
  exit 1
fi

echo '[6/10] Switching product images from Vercel URLs to local URLs'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz \
  -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "Product"
SET "photo" = '/uploads/' || regexp_replace("photo", '^https://[^/]+/', '')
WHERE "photo" ~ '^https://[^/]+[.]public[.]blob[.]vercel-storage[.]com/';
SQL

echo '[7/10] Building the application and pruning development dependencies'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP_BUILD'
set -euo pipefail
release_dir=$1
set -a
# shellcheck disable=SC1091
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
npm run build
npm prune --omit=dev --no-audit --no-fund
APP_BUILD

echo '[8/10] Installing systemd and Nginx configuration'
ln -sfn "$release_dir" "$app_root/current"
cat > /etc/systemd/system/katalog-hoz.service <<'SYSTEMD'
[Unit]
Description=Katalog Hoz Next.js application
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=kataloghoz
Group=kataloghoz
WorkingDirectory=/srv/katalog-hoz/current
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/etc/katalog-hoz.env
ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1
Restart=always
RestartSec=5
TimeoutStartSec=90
TimeoutStopSec=30
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
SYSTEMD

cat > /etc/nginx/sites-available/katalog-hoz <<'NGINX'
upstream katalog_hoz_app {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name almatytovar.kz www.almatytovar.kz catalog.almatytovar.kz 46.247.41.103;

    client_max_body_size 20m;

    location /uploads/ {
        alias /srv/katalog-hoz/shared/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /_next/static/ {
        proxy_cache_valid 200 30d;
        proxy_pass http://katalog_hoz_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://katalog_hoz_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX
ln -sfn /etc/nginx/sites-available/katalog-hoz /etc/nginx/sites-enabled/katalog-hoz
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now katalog-hoz
systemctl reload nginx

echo '[9/10] Preserving recovery archives and installing daily DB backups'
install -o root -g root -m 600 "$transfer_dir/data.sql" "$app_root/shared/backups/neon-2026-08-20.sql"
install -o root -g root -m 600 "$transfer_dir/katalog-source.tar.gz" "$app_root/shared/backups/katalog-source-2026-08-20.tar.gz"
install -o root -g root -m 600 "$transfer_dir/vercel-blob-objects.tar" "$app_root/shared/backups/vercel-blob-2026-08-20.tar"

cat > /usr/local/sbin/katalog-hoz-backup <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
source /root/katalog-hoz-secrets.env
backup_dir=/srv/katalog-hoz/shared/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz \
  --format=custom --file="$backup_dir/postgresql-$timestamp.dump"
find "$backup_dir" -maxdepth 1 -type f -name 'postgresql-*.dump' -mtime +14 -delete
BACKUP
chmod 700 /usr/local/sbin/katalog-hoz-backup

cat > /etc/systemd/system/katalog-hoz-backup.service <<'BACKUP_SERVICE'
[Unit]
Description=Katalog Hoz PostgreSQL backup

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/katalog-hoz-backup
BACKUP_SERVICE

cat > /etc/systemd/system/katalog-hoz-backup.timer <<'BACKUP_TIMER'
[Unit]
Description=Daily Katalog Hoz PostgreSQL backup

[Timer]
OnCalendar=*-*-* 02:30:00 UTC
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
BACKUP_TIMER
systemctl daemon-reload
systemctl enable --now katalog-hoz-backup.timer
/usr/local/sbin/katalog-hoz-backup

install -o root -g root -m 600 /dev/null /root/katalog-hoz-admin.txt
cat > /root/katalog-hoz-admin.txt <<ADMIN
URL=https://catalog.almatytovar.kz/admin/login
ADMIN_LOGIN=${ADMIN_LOGIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN
chmod 600 /root/katalog-hoz-admin.txt

echo '[10/10] Waiting for the application and verifying recovered data'
for _ in $(seq 1 30); do
  if curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1/ >/dev/null; then
    break
  fi
  sleep 2
done
curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1/ >/dev/null

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -At <<'COUNTS'
SELECT 'AppSettings=' || count(*) FROM "AppSettings";
SELECT 'Category=' || count(*) FROM "Category";
SELECT 'Subcategory=' || count(*) FROM "Subcategory";
SELECT 'Product=' || count(*) FROM "Product";
SELECT 'Client=' || count(*) FROM "Client";
SELECT 'ClientSelectedProduct=' || count(*) FROM "ClientSelectedProduct";
SELECT 'LocalProductPhotos=' || count(*) FROM "Product" WHERE "photo" LIKE '/uploads/%';
COUNTS
echo "BlobFiles=$(find "$app_root/shared/uploads" -type f | wc -l)"
echo "BlobBytes=$(find "$app_root/shared/uploads" -type f -printf '%s\n' | awk '{sum += $1} END {print sum + 0}')"
echo "DebugRouteStatus=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1/api/debug)"
echo "ServiceStatus=$(systemctl is-active katalog-hoz)"
echo "Admin credentials: /root/katalog-hoz-admin.txt (mode 600)"
