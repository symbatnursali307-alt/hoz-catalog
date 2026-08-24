#!/usr/bin/env bash
set -Eeuo pipefail
target=/home/ubuntu/katalog-offsite-transfer
test "$target" = /home/ubuntu/katalog-offsite-transfer
rm -rf -- "$target"
echo 'OFFSITE_TRANSFER_CLEANED=1'
