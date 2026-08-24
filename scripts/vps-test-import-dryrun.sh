#!/usr/bin/env bash
set -Eeuo pipefail
source /root/katalog-hoz-secrets.env
set -a
source /etc/katalog-hoz.env
set +a
base=http://127.0.0.1:3000
category=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -Atc 'SELECT name FROM "Category" ORDER BY "sortOrder", id LIMIT 1')
export DRY_CATEGORY="$category"
payload=$(python3 - <<'PY'
import json,os
print(json.dumps({"dryRun":True,"items":[{
  "external_id":"CODEX-DRY-RUN-ONLY","name":"Проверка импорта без записи","category":os.environ["DRY_CATEGORY"],
  "price_with_vat":10,"unit_name":"шт","package_type":"коробка","units_per_package":12,
  "package_unit":"шт","min_order_packages":1,"is_active":True
}]},ensure_ascii=False))
PY
)
curl -fsS -H "x-admin-secret: $ADMIN_SECRET" -H 'Content-Type: application/json' --data "$payload" "$base/api/admin/import/products" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] is True and d["dryRun"] is True and d["created"]==1 and d["skipped"]==0'
test "$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U kataloghoz -d kataloghoz -Atc "SELECT count(*) FROM \"Product\" WHERE \"externalId\"='CODEX-DRY-RUN-ONLY'")" = 0
echo 'IMPORT_DRY_RUN=PASS'
