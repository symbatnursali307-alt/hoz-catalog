#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-site"
stage_db=kataloghoz_site_stage
stage_env=/etc/katalog-hoz-site-stage.env
runtime_env=/etc/katalog-hoz.env
backup_dir="$app_root/shared/backups"
source_archive=/home/ubuntu/katalog-site-stage.tar.gz
release_id="company-site-$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
old_release=$(readlink -f "$app_root/current")
pre_migration_counts=$(mktemp)
post_migration_counts=$(mktemp)

test "$stage_dir" = /srv/katalog-hoz/staging-site
test -d "$stage_dir/.next"
test -f "$stage_dir/proxy.ts"
test -f "$runtime_env"
test -n "$old_release"
source /root/katalog-hoz-secrets.env

rollback() {
  rm -f -- "$pre_migration_counts" "$post_migration_counts"
  if [[ -n "${old_release:-}" && -d "$old_release" ]]; then
    ln -sfn "$old_release" "$app_root/current"
    systemctl restart katalog-hoz || true
  fi
}
trap 'echo "Promotion failed; restoring previous release" >&2; rollback' ERR

echo '[1/6] Creating the pre-release database backup'
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
pre_backup="$backup_dir/postgresql-pre-company-site-$timestamp.dump"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d kataloghoz -At <<'SQL' > "$pre_migration_counts"
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'orders=' || count(*) FROM "CartSubmission";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
umask 077
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U kataloghoz -d kataloghoz --format=custom --file="$pre_backup"
pg_restore --list "$pre_backup" >/dev/null
sha256sum "$pre_backup" > "$pre_backup.sha256"

echo '[2/6] Promoting the staging-tested build'
systemctl stop katalog-hoz-stage
mv -- "$stage_dir" "$release_dir"
chown -R kataloghoz:kataloghoz "$release_dir"

echo '[3/6] Applying migrations and verifying protected data'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP'
set -Eeuo pipefail
release_dir=$1
set -a
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
APP
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d kataloghoz -At <<'SQL' > "$post_migration_counts"
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'orders=' || count(*) FROM "CartSubmission";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
cat "$post_migration_counts"
# Product reviews can be resolved by an administrator while a release is being
# promoted. Keep reporting that live counter, but compare protected catalog,
# order, cart and pricing data strictly.
diff -u \
  <(grep -v '^reviews=' "$pre_migration_counts") \
  <(grep -v '^reviews=' "$post_migration_counts")
grep -qx 'cart_enabled=true' "$post_migration_counts"
grep -qx 'fractional_prices=0' "$post_migration_counts"

echo '[4/6] Switching the production application'
ln -sfn "$release_dir" "$app_root/current"
systemctl restart katalog-hoz
for _ in $(seq 1 40); do
  if curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/ >/dev/null; then break; fi
  sleep 2
done

echo '[5/6] Verifying both production domains'
main_html=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/)
catalog_html=$(curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/)
grep -q 'Хозяйственные товары оптом в Алматы' <<<"$main_html"
grep -q 'FAQPage' <<<"$main_html"
grep -q 'Загрузка каталога' <<<"$catalog_html"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/products?limit=1)" = 200
first_catalog_category=$(curl -fsS -H 'Host: catalog.almatytovar.kz' 'http://127.0.0.1:3000/api/products?limit=1' \
  | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  process.stdout.write(data.items?.[0]?.category?.slug || "");
});
')
test "$first_catalog_category" = perchatki
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/admin/login)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/admin/cart-submissions)" = 307
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/admin/cart-submissions)" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/admin/product-reviews)" = 401
catalog_config=$(curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/catalog-config)
grep -q '"contactStepEnabled":false' <<<"$catalog_config"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: almatytovar.kz' http://127.0.0.1:3000/categories/perchatki)" = 200
for_ai_html=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/for-ai)
grep -q 'Официальная справочная страница' <<<"$for_ai_html"
llms_text=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/llms.txt)
grep -q 'Almaty.tovar — оптовые хозяйственные товары' <<<"$llms_text"
company_json=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/company.json)
grep -q '"pricesIncludeVat":true' <<<"$company_json"
robots_txt=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/robots.txt)
grep -q 'OAI-SearchBot' <<<"$robots_txt"
grep -q 'Disallow: /order/' <<<"$robots_txt"
sitemap_xml=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3000/sitemap.xml)
grep -q '/for-ai' <<<"$sitemap_xml"
! grep -q '/order/' <<<"$sitemap_xml"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/for-ai)" = 308
order_access=$(runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d kataloghoz -At -F '|' -c 'SELECT "orderNumber", "accessToken" FROM "CartSubmission" ORDER BY "createdAt" DESC LIMIT 1')
IFS='|' read -r order_number order_token <<<"$order_access"
test -n "$order_number"
test -n "$order_token"
order_path="/order/${order_number}-${order_token}"
order_html=$(curl -fsS -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1:3000${order_path}")
grep -q 'Заказ №' <<<"$order_html"
grep -q 'Товары в заказе' <<<"$order_html"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1:3000${order_path}x")" = 404

echo '[6/6] Preserving source and cleaning isolated staging resources'
install -o root -g root -m 600 "$source_archive" "$backup_dir/katalog-source-$release_id.tar.gz"
runuser -u postgres -- dropdb --if-exists --force "$stage_db"
rm -f -- "$stage_env" "$source_archive"
systemctl disable katalog-hoz-stage >/dev/null 2>&1 || true
rm -f -- /etc/systemd/system/katalog-hoz-stage.service
systemctl daemon-reload
rm -f -- "$pre_migration_counts" "$post_migration_counts"

echo "release=$release_id"
echo "previous_release=$old_release"
echo "backup=$pre_backup"
echo "service=$(systemctl is-active katalog-hoz)"
echo 'COMPANY_SITE_PRODUCTION=PASS'
trap - ERR
