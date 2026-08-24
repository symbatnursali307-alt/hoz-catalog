#!/usr/bin/env bash
set -Eeuo pipefail

patch_file=/home/ubuntu/cleaned-catalog-patch.json
source_file=/home/ubuntu/cleaned-catalog-source.xlsx
runner=/home/ubuntu/apply-cleaned-catalog.mjs
expected_patch_sha256=121b5a2a9975aa293a6355f97209c975aa821c065d5cc6199678d9bbee786805
expected_source_sha256=8a64bd12627090a0e64efe80a5d155b9cfab0ef8e2806f36fccf8c062fc5ddff

test -f "$patch_file"
test -f "$source_file"
test -f "$runner"
echo "$expected_patch_sha256  $patch_file" | sha256sum -c -
echo "$expected_source_sha256  $source_file" | sha256sum -c -

set -a
source /etc/katalog-hoz.env
set +a
cd /srv/katalog-hoz/current
/usr/bin/node "$runner" --patch "$patch_file"
