#!/usr/bin/env bash
set -Eeuo pipefail

output=/home/ubuntu/catalog-products-for-correction.xls
set -a
source /etc/katalog-hoz.env
set +a

curl -fsS -H "x-admin-secret: $ADMIN_SECRET" \
  'http://127.0.0.1:3000/api/admin/export/products?format=xls' \
  -o "$output"

python3 - "$output" <<'PY'
import pathlib, sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
assert text.startswith('<?xml version="1.0"'), 'Not an Excel XML document'
rows = text.count('<Row>')
assert rows == 451, rows
print(f'products={rows - 1}')
PY

chown ubuntu:ubuntu "$output"
chmod 600 "$output"
echo "output=$output"
echo "bytes=$(stat -c %s "$output")"
