#!/usr/bin/env bash
set -euo pipefail

target=/home/ubuntu/katalog-transfer
resolved=$(realpath "$target")
if [[ "$resolved" != '/home/ubuntu/katalog-transfer' ]]; then
  echo "Unexpected cleanup path: $resolved" >&2
  exit 1
fi

echo 'a9c8e373a9868bada568380be2ad1450f328393a7f50f71f124a180126d60a7b  /srv/katalog-hoz/shared/backups/katalog-source-2026-08-20.tar.gz' | sha256sum -c -
echo '01f667766ffb7d3782b3d809a1b02c7203617575409ee15a0b3911caf889fb8b  /srv/katalog-hoz/shared/backups/vercel-blob-2026-08-20.tar' | sha256sum -c -
echo 'bbbe902afb91554865bfa99fdefc4028d78bf2e9614fc85acb9b38bb3dbb2749  /srv/katalog-hoz/shared/backups/neon-2026-08-20.sql' | sha256sum -c -

rm -rf -- "$resolved"
if [[ -e "$target" ]]; then
  echo 'Temporary transfer directory still exists' >&2
  exit 1
fi
echo 'Temporary transfer directory removed; protected backups verified.'
