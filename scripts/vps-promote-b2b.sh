#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-b2b"
release_id="b2b-$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
runtime_env=/etc/katalog-hoz.env
backup_dir="$app_root/shared/backups"
source_archive=/home/ubuntu/katalog-b2b-stage.tar.gz
old_release=$(readlink -f "$app_root/current")

test -d "$stage_dir/.next"
test -f "$stage_dir/prisma/migrations/20260820010000_b2b_catalog/migration.sql"
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

echo '[1/8] Creating an immediate pre-migration database backup'
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
pre_backup="$backup_dir/pre-b2b-$timestamp.dump"
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$pre_backup"
pg_restore --list "$pre_backup" >/dev/null
sha256sum "$pre_backup" > "$pre_backup.sha256"

echo '[2/8] Promoting the exact staging-tested application build'
systemctl stop katalog-hoz-stage
mv -- "$stage_dir" "$release_dir"
chown -R kataloghoz:kataloghoz "$release_dir"

echo '[3/8] Adding production settings without enabling external integrations'
if ! grep -q '^SITE_URL=' "$runtime_env"; then echo 'SITE_URL=https://catalog.almatytovar.kz' >> "$runtime_env"; fi
if ! grep -q '^ANALYTICS_SALT=' "$runtime_env"; then echo "ANALYTICS_SALT=$(openssl rand -hex 32)" >> "$runtime_env"; fi
if ! grep -q '^NEXT_TELEMETRY_DISABLED=' "$runtime_env"; then echo 'NEXT_TELEMETRY_DISABLED=1' >> "$runtime_env"; fi
chown root:kataloghoz "$runtime_env"
chmod 640 "$runtime_env"

echo '[4/8] Applying the tested backward-compatible production migration'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP'
set -Eeuo pipefail
release_dir=$1
set -a
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
if ! ./node_modules/.bin/prisma migrate status 2>&1 | grep -q 'Database schema is up to date'; then
  if ! ./node_modules/.bin/prisma migrate resolve --applied 20260820000000_baseline 2>&1 | grep -Eq 'marked as applied|already recorded'; then
    echo 'Could not record baseline migration' >&2
    exit 1
  fi
  ./node_modules/.bin/prisma migrate deploy
fi
./node_modules/.bin/prisma migrate status
APP

echo '[5/8] Verifying migrated production data and safety gate'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -At -v ON_ERROR_STOP=1 <<'SQL' | tee /tmp/katalog-b2b-production-counts.txt
SELECT 'products=' || count(*) FROM "Product";
SELECT 'categories=' || count(*) FROM "Category";
SELECT 'subcategories=' || count(*) FROM "Subcategory";
SELECT 'clients=' || count(*) FROM "Client";
SELECT 'managers=' || count(*) FROM "Manager";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'missing_slug=' || count(*) FROM "Product" WHERE slug IS NULL OR slug='';
SQL
grep -qx 'products=450' /tmp/katalog-b2b-production-counts.txt
grep -qx 'categories=11' /tmp/katalog-b2b-production-counts.txt
grep -qx 'subcategories=23' /tmp/katalog-b2b-production-counts.txt
grep -qx 'clients=7' /tmp/katalog-b2b-production-counts.txt
grep -qx 'cart_enabled=false' /tmp/katalog-b2b-production-counts.txt
grep -qx 'missing_slug=0' /tmp/katalog-b2b-production-counts.txt
rm -f -- /tmp/katalog-b2b-production-counts.txt

echo '[6/8] Switching the application release and checking localhost'
ln -sfn "$release_dir" "$app_root/current"
systemctl restart katalog-hoz
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/debug)" = 404

echo '[7/8] Extending daily backups to include uploaded images'
cat > /usr/local/sbin/katalog-hoz-backup <<'BACKUP'
#!/usr/bin/env bash
set -Eeuo pipefail
source /root/katalog-hoz-secrets.env
backup_dir=/srv/katalog-hoz/shared/backups
uploads_dir=/srv/katalog-hoz/shared/uploads
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$backup_dir/postgresql-$timestamp.dump"
tar -cf "$backup_dir/uploads-$timestamp.tar" -C "$uploads_dir" .
find "$backup_dir" -maxdepth 1 -type f -name 'postgresql-*.dump' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -type f -name 'uploads-*.tar' -mtime +7 -delete
BACKUP
chmod 700 /usr/local/sbin/katalog-hoz-backup
/usr/local/sbin/katalog-hoz-backup

echo '[8/8] Preserving release source and reporting health'
install -o root -g root -m 600 "$source_archive" "$backup_dir/katalog-source-$release_id.tar.gz"
systemctl enable katalog-hoz >/dev/null
echo "release=$release_id"
echo "previous_release=$old_release"
echo "service=$(systemctl is-active katalog-hoz)"
echo "http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
echo "feed=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/meta-feed.csv)"
echo "cart_enabled=$(curl -fsS http://127.0.0.1:3000/api/catalog-config | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["cartEnabled"]).lower())')"
trap - ERR
