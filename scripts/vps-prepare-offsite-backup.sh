#!/usr/bin/env bash
set -Eeuo pipefail
backup_dir=/srv/katalog-hoz/shared/backups
transfer_dir=/home/ubuntu/katalog-offsite-transfer
db_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'postgresql-*.dump' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
image_backup=$(find "$backup_dir" -maxdepth 1 -type f -name 'uploads-*.tar' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
test -n "$db_backup"
test -n "$image_backup"
rm -rf -- "$transfer_dir"
install -d -o ubuntu -g ubuntu -m 700 "$transfer_dir"
install -o ubuntu -g ubuntu -m 600 "$db_backup" "$transfer_dir/postgresql-latest.dump"
install -o ubuntu -g ubuntu -m 600 "$image_backup" "$transfer_dir/uploads-latest.tar"
sha256sum "$transfer_dir/postgresql-latest.dump" "$transfer_dir/uploads-latest.tar" > "$transfer_dir/SHA256SUMS"
chown ubuntu:ubuntu "$transfer_dir/SHA256SUMS"
chmod 600 "$transfer_dir/SHA256SUMS"
echo "db_bytes=$(stat -c %s "$transfer_dir/postgresql-latest.dump")"
echo "uploads_bytes=$(stat -c %s "$transfer_dir/uploads-latest.tar")"
