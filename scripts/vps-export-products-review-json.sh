#!/usr/bin/env bash
set -Eeuo pipefail

output=/home/ubuntu/catalog-products-review.json
set -a
source /etc/katalog-hoz.env
set +a

curl -fsS -H "x-admin-secret: $ADMIN_SECRET" \
  http://127.0.0.1:3000/api/admin/product-reviews \
  -o "$output"

python3 - "$output" <<'PY'
import json, sys

path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
assert data['stats']['totalProducts'] == 450, data['stats']
assert len(data['items']) == 450, len(data['items'])
print('stats=' + json.dumps(data['stats'], ensure_ascii=False, sort_keys=True))
PY

chown ubuntu:ubuntu "$output"
chmod 600 "$output"
echo "output=$output"
echo "bytes=$(stat -c %s "$output")"
