#!/usr/bin/env bash
set -u
stage_db=kataloghoz_b2b_stage
base=http://127.0.0.1:3001
product_id=$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT id FROM \"Product\" WHERE \"priceWithVat\"=10 AND \"unitsPerPackage\"=12 LIMIT 1")
echo "product_id_present=$([[ -n "$product_id" ]] && echo yes || echo no)"
echo "config_status=$(curl -sS -o /tmp/stage-config.json -w '%{http_code}' "$base/api/catalog-config")"
python3 - /tmp/stage-config.json <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
print('cart_enabled='+str(d.get('cartEnabled')))
print('manager_slugs='+','.join(x.get('slug','') for x in d.get('managers',[])))
PY
echo "products_status=$(curl -sS -o /tmp/stage-products.json -w '%{http_code}' "$base/api/products?limit=500&offset=0")"
PRODUCT_ID="$product_id" python3 - /tmp/stage-products.json <<'PY'
import json,os,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
print('product_total='+str(d.get('total')))
p=next((x for x in d.get('items',[]) if x.get('id')==os.environ['PRODUCT_ID']),{})
print('test_product='+json.dumps({k:p.get(k) for k in ('id','orderable','packagePrice','minOrderPackages','priceWithVat','unitsPerPackage')},ensure_ascii=False))
PY
echo "feed_status=$(curl -sS -o /tmp/stage-feed.csv -w '%{http_code}' "$base/api/meta-feed.csv")"
echo "feed_lines=$(wc -l < /tmp/stage-feed.csv)"
head -n 2 /tmp/stage-feed.csv
rm -f /tmp/stage-config.json /tmp/stage-products.json /tmp/stage-feed.csv
