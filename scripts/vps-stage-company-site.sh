#!/usr/bin/env bash
set -Eeuo pipefail

expected_archive_sha256=${1:?Pass expected archive SHA-256}
archive=/home/ubuntu/katalog-site-stage.tar.gz
app_root=/srv/katalog-hoz
stage_dir="$app_root/staging-site"
stage_db=kataloghoz_site_stage
stage_env=/etc/katalog-hoz-site-stage.env
production_counts=$(mktemp)
stage_counts=$(mktemp)

cleanup() {
  rm -f -- "$production_counts" "$stage_counts"
}
trap cleanup EXIT

test "$stage_dir" = /srv/katalog-hoz/staging-site
test -f "$archive"
echo "$expected_archive_sha256  $archive" | sha256sum -c -

echo '[1/7] Cloning production data into an isolated staging database'
systemctl stop katalog-hoz-stage 2>/dev/null || true
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d kataloghoz -At <<'SQL' > "$production_counts"
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'orders=' || count(*) FROM "CartSubmission";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
runuser -u postgres -- dropdb --if-exists --force "$stage_db"
runuser -u postgres -- createdb --owner=kataloghoz "$stage_db"
runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl kataloghoz \
  | runuser -u postgres -- pg_restore --exit-on-error --no-owner --role=kataloghoz --dbname="$stage_db"

echo '[2/7] Extracting the candidate release'
rm -rf -- "$stage_dir"
install -d -o kataloghoz -g kataloghoz "$stage_dir"
tar -xzf "$archive" -C "$stage_dir"
chown -R kataloghoz:kataloghoz "$stage_dir"
test -f "$stage_dir/proxy.ts"
test -f "$stage_dir/app/site/page.tsx"
test -f "$stage_dir/app/categories/[slug]/page.tsx"
test -f "$stage_dir/app/sitemap.ts"
test -f "$stage_dir/app/robots.ts"
grep -q 'Хозяйственные товары оптом в Алматы' "$stage_dir/app/site/page.tsx"

echo '[3/7] Preparing the isolated runtime environment'
db_password=$(sed -n 's/^DB_PASSWORD=//p' /root/katalog-hoz-secrets.env)
test -n "$db_password"
install -o root -g kataloghoz -m 640 /dev/null "$stage_env"
awk -F= '!/^DATABASE_URL=|^PORT=|^SITE_URL=|^NEXT_TELEMETRY_DISABLED=/ { print }' /etc/katalog-hoz.env > "$stage_env"
{
  echo "DATABASE_URL=postgresql://kataloghoz:${db_password}@127.0.0.1:5432/${stage_db}?schema=public"
  echo 'PORT=3001'
  echo 'SITE_URL=https://catalog.almatytovar.kz'
  echo 'NEXT_TELEMETRY_DISABLED=1'
} >> "$stage_env"
chown root:kataloghoz "$stage_env"
chmod 640 "$stage_env"

echo '[4/7] Installing, testing and building staging'
runuser -u kataloghoz -- /bin/bash -s -- "$stage_dir" "$stage_env" <<'APP'
set -Eeuo pipefail
release_dir=$1
environment=$2
set -a
source "$environment"
set +a
cd "$release_dir"
npm ci --no-audit --no-fund
./node_modules/.bin/prisma migrate deploy
npm run test:packaging
npm run test:quality
npm run test:pwa
npm run test:pricing
npm run test:orders
npm run build
APP

echo '[5/7] Verifying the cloned production data'
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$stage_db" -At <<'SQL' > "$stage_counts"
SELECT 'products=' || count(*) FROM "Product";
SELECT 'reviews=' || count(*) FROM "ProductReview" WHERE status='PENDING';
SELECT 'orders=' || count(*) FROM "CartSubmission";
SELECT 'cart_enabled=' || "cartEnabled" FROM "AppSettings" WHERE id='default';
SELECT 'fractional_prices=' || count(*) FROM "Product" WHERE "priceWithVat" IS NOT NULL AND "priceWithVat" <> CEIL("priceWithVat");
SQL
cat "$stage_counts"
diff -u "$production_counts" "$stage_counts"
grep -qx 'cart_enabled=true' "$stage_counts"
grep -qx 'fractional_prices=0' "$stage_counts"

echo '[6/7] Starting the candidate on 127.0.0.1:3001'
cat > /etc/systemd/system/katalog-hoz-stage.service <<SYSTEMD
[Unit]
Description=Katalog Hoz company site staging
After=network-online.target postgresql.service

[Service]
Type=simple
User=kataloghoz
Group=kataloghoz
WorkingDirectory=$stage_dir
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=$stage_env
ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
SYSTEMD
systemctl daemon-reload
systemctl restart katalog-hoz-stage
for _ in $(seq 1 40); do
  if curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/ >/dev/null; then break; fi
  sleep 2
done

echo '[7/7] Verifying host routing, SEO and the unchanged catalog'
main_html=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/)
catalog_html=$(curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/)
grep -q 'Хозяйственные товары оптом в Алматы' <<<"$main_html"
grep -q 'FAQPage' <<<"$main_html"
grep -q 'Organization' <<<"$main_html"
grep -q 'Загрузка каталога' <<<"$catalog_html"
test "$(grep -o '<h1' <<<"$main_html" | wc -l)" = 1
category_html=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/categories/perchatki)
grep -q 'BreadcrumbList' <<<"$category_html"
for_ai_html=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/for-ai)
grep -q 'Официальная справочная страница' <<<"$for_ai_html"
llms_text=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/llms.txt)
grep -q 'Almaty.tovar — оптовые хозяйственные товары' <<<"$llms_text"
company_json=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/company.json)
grep -q '"pricesIncludeVat":true' <<<"$company_json"
robots_txt=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/robots.txt)
grep -q 'OAI-SearchBot' <<<"$robots_txt"
grep -q 'Disallow: /admin' <<<"$robots_txt"
grep -q 'Disallow: /order/' <<<"$robots_txt"
sitemap_xml=$(curl -fsS -H 'Host: almatytovar.kz' http://127.0.0.1:3001/sitemap.xml)
grep -q '/categories/perchatki' <<<"$sitemap_xml"
grep -q '/for-ai' <<<"$sitemap_xml"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/for-ai)" = 308
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/api/products?limit=1)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/admin/login)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/admin/cart-submissions)" = 307
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/api/admin/cart-submissions)" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/api/admin/product-reviews)" = 401
catalog_config=$(curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3001/api/catalog-config)
grep -q '"contactStepEnabled":false' <<<"$catalog_config"
products_json=$(curl -fsS -H 'Host: catalog.almatytovar.kz' 'http://127.0.0.1:3001/api/products?limit=100')
printf '%s' "$products_json" | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  if (!data.items?.length || data.items[0]?.category?.slug !== "perchatki") process.exit(2);
});
'
smoke_request=$(printf '%s' "$products_json" | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const product = data.items.find((item) => item.orderable && (item.imageUrl || item.photo));
  if (!product) process.exit(2);
  process.stdout.write(JSON.stringify({
    visitorId: "direct-whatsapp-stage",
    sessionId: "direct-whatsapp-stage",
    idempotencyKey: "direct-whatsapp-stage-order-20260824",
    phone: null,
    items: [{ id: product.id, packageQuantity: product.minOrderPackages || 1 }],
  }));
});
')
smoke_response=$(curl -fsS \
  -H 'Host: catalog.almatytovar.kz' \
  -H 'Content-Type: application/json' \
  --data "$smoke_request" \
  http://127.0.0.1:3001/api/cart-submissions)
smoke_retry_response=$(curl -fsS \
  -H 'Host: catalog.almatytovar.kz' \
  -H 'Content-Type: application/json' \
  --data "$smoke_request" \
  http://127.0.0.1:3001/api/cart-submissions)
order_path=$(printf '%s\n%s\n' "$smoke_response" "$smoke_retry_response" | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const [created, retried] = input.trim().split("\n").map(JSON.parse);
  if (!created.success || created.created !== true) process.exit(2);
  if (!retried.success || retried.created !== false) process.exit(3);
  if (created.submissionId !== retried.submissionId || created.orderNumber !== retried.orderNumber) process.exit(4);
  if (!Number.isInteger(created.orderNumber) || created.orderNumber < 10001) process.exit(5);
  if (!created.whatsappUrl.startsWith("https://wa.me/") || !created.orderUrl) process.exit(6);
  process.stdout.write(new URL(created.orderUrl).pathname);
});
')
order_html=$(curl -fsS -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1:3001${order_path}")
grep -q 'Заказ №' <<<"$order_html"
grep -q 'Товары в заказе' <<<"$order_html"
grep -q 'object-contain p-1.5' <<<"$order_html"
order_headers=$(curl -sSI -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1:3001${order_path}")
grep -qi 'x-robots-tag: noindex, nofollow, noarchive' <<<"$order_headers"
grep -qi 'cache-control: private, no-store' <<<"$order_headers"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1:3001${order_path}x")" = 404
echo "stage_service=$(systemctl is-active katalog-hoz-stage)"
echo 'COMPANY_SITE_STAGE=PASS'
