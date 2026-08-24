#!/usr/bin/env bash
set -Eeuo pipefail

backup_dir=/srv/katalog-hoz/shared/backups
pre="$backup_dir/postgresql-pre-packaging-20260820T195649Z.dump"
audit="$backup_dir/packaging-updates-20260820T195649Z.csv"
post="$backup_dir/postgresql-post-packaging-20260820T195846Z.dump"

test -f "$pre"
test -f "$audit"
test -f "$post"
pg_restore --list "$pre" >/dev/null
pg_restore --list "$post" >/dev/null
echo '4884e95ecd5a1c2a8a04381008b940fb3ae09c93e8995e554f0cedf7fe1ddf33  /srv/katalog-hoz/shared/backups/packaging-updates-20260820T195649Z.csv' | sha256sum -c -
echo '0ca695e6b9ba2b434415ea80367fe23f97e1a8069e8a24ffe0a4688623eda4c2  /srv/katalog-hoz/shared/backups/postgresql-post-packaging-20260820T195846Z.dump' | sha256sum -c -

rm -f -- \
  /home/ubuntu/product-packaging-source.csv \
  /home/ubuntu/packaging-updates.csv \
  /home/ubuntu/vps-apply-packaging-normalization.sh \
  /home/ubuntu/postgresql-post-packaging.dump

echo 'Verified protected backups; temporary packaging transfer files removed.'
