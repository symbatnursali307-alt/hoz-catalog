#!/usr/bin/env bash
set -Eeuo pipefail

backup_dir=/srv/katalog-hoz/shared/backups
verify_db=kataloghoz_restore_verify
db_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'postgresql-*.dump' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
image_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'uploads-*.tar' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
test -n "$db_backup"
test -n "$image_backup"

echo '[1/4] Validating backup archives'
pg_restore --list "$db_backup" >/dev/null
image_files=$(tar -tf "$image_backup" | grep -vc '/$')
test "$image_files" = 476

echo '[2/4] Restoring latest database backup into an isolated verification database'
runuser -u postgres -- dropdb --if-exists --force "$verify_db"
runuser -u postgres -- createdb --owner=kataloghoz "$verify_db"
cat "$db_backup" | runuser -u postgres -- pg_restore --exit-on-error --no-owner --role=kataloghoz --dbname="$verify_db"

echo '[3/4] Checking restored schema and records'
counts=$(runuser -u postgres -- psql -d "$verify_db" -At <<'SQL'
SELECT count(*) FROM "Product";
SELECT count(*) FROM "Category";
SELECT count(*) FROM "Subcategory";
SELECT count(*) FROM "Client";
SELECT count(*) FROM "Manager";
SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;
SQL
)
expected=$'450\n11\n23\n7\n1\n2'
test "$counts" = "$expected"

echo '[4/4] Removing only the isolated verification database and staging resources'
runuser -u postgres -- dropdb --force "$verify_db"
systemctl disable --now katalog-hoz-stage 2>/dev/null || true
rm -f -- /etc/systemd/system/katalog-hoz-stage.service /etc/katalog-hoz-stage.env /home/ubuntu/katalog-b2b-stage.tar.gz /home/ubuntu/vps-stage-b2b.sh
systemctl daemon-reload
runuser -u postgres -- dropdb --if-exists --force kataloghoz_b2b_stage
echo "database_backup=$(basename "$db_backup")"
echo "image_backup=$(basename "$image_backup")"
echo "image_files=$image_files"
echo 'BACKUP_RESTORE_TEST=PASS'
