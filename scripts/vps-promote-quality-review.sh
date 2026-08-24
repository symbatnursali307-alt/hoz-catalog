#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-quality"
release_id="quality-review-$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
runtime_env=/etc/katalog-hoz.env
backup_dir="$app_root/shared/backups"
source_archive=/home/ubuntu/katalog-quality-stage.tar.gz
old_release=$(readlink -f "$app_root/current")

test -d "$stage_dir/.next"
test -f "$stage_dir/prisma/migrations/20260821010000_product_review_queue/migration.sql"
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

echo '[1/7] Creating and validating a pre-migration backup'
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
pre_backup="$backup_dir/postgresql-pre-quality-review-$timestamp.dump"
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$pre_backup"
pg_restore --list "$pre_backup" >/dev/null
sha256sum "$pre_backup" > "$pre_backup.sha256"

echo '[2/7] Promoting the staging-tested build'
systemctl stop katalog-hoz-stage
mv -- "$stage_dir" "$release_dir"
chown -R kataloghoz:kataloghoz "$release_dir"

echo '[3/7] Applying the additive production migration'
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

echo '[4/7] Verifying production data and preserved cart state'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -At -v ON_ERROR_STOP=1 <<'SQL' > /tmp/katalog-quality-counts.txt
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'quality_migration=' || count(*) FROM "_prisma_migrations" WHERE migration_name='20260821010000_product_review_queue' AND finished_at IS NOT NULL;
SQL
cat /tmp/katalog-quality-counts.txt
grep -qx 'products=450' /tmp/katalog-quality-counts.txt
grep -qx 'reviews=0' /tmp/katalog-quality-counts.txt
grep -qx 'cart_enabled=true' /tmp/katalog-quality-counts.txt
grep -qx 'quality_migration=1' /tmp/katalog-quality-counts.txt
rm -f -- /tmp/katalog-quality-counts.txt

echo '[5/7] Switching the application release'
ln -sfn "$release_dir" "$app_root/current"
systemctl restart katalog-hoz
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/debug)" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/admin/product-reviews)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/admin/product-review)" = 200

echo '[6/7] Creating a post-migration backup'
post_backup="$backup_dir/postgresql-post-quality-review-$timestamp.dump"
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$post_backup"
pg_restore --list "$post_backup" >/dev/null
sha256sum "$post_backup" > "$post_backup.sha256"

echo '[7/7] Preserving source and reporting health'
install -o root -g root -m 600 "$source_archive" "$backup_dir/katalog-source-$release_id.tar.gz"
rm -f -- "$source_archive"
echo "release=$release_id"
echo "previous_release=$old_release"
echo "pre_backup=$pre_backup"
echo "post_backup=$post_backup"
echo "service=$(systemctl is-active katalog-hoz)"
echo "http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
echo "cart_enabled=$(curl -fsS http://127.0.0.1:3000/api/catalog-config | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["cartEnabled"]).lower())')"
trap - ERR
