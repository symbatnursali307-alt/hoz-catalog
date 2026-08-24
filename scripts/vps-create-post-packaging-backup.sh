#!/usr/bin/env bash
set -Eeuo pipefail

source /root/katalog-hoz-secrets.env

backup_dir=/srv/katalog-hoz/shared/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
transfer=/home/ubuntu/postgresql-post-packaging.dump
stored="$backup_dir/postgresql-post-packaging-$timestamp.dump"

rm -f -- "$transfer"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 \
  -U kataloghoz \
  -d kataloghoz \
  --format=custom \
  --file="$transfer"
pg_restore --list "$transfer" >/dev/null
install -o root -g root -m 600 "$transfer" "$stored"
chown ubuntu:ubuntu "$transfer"
chmod 600 "$transfer"

echo "stored=$stored"
sha256sum "$transfer"
stat -c 'bytes=%s' "$transfer"
