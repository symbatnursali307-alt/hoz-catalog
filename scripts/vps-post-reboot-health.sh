#!/usr/bin/env bash
set -euo pipefail

echo "Kernel=$(uname -r)"
echo "Uptime=$(uptime -p)"
echo "CPU=$(nproc)"
echo "CurrentRelease=$(readlink -f /srv/katalog-hoz/current)"
free -h
df -h /
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS
echo "App=$(systemctl is-active katalog-hoz)"
echo "Nginx=$(systemctl is-active nginx)"
echo "PostgreSQL=$(systemctl is-active postgresql)"
echo "DBBackupTimer=$(systemctl is-active katalog-hoz-backup.timer)"
echo "CertbotTimer=$(systemctl is-active certbot.timer)"
ss -lntp | grep ':3000'
runuser -u postgres -- psql -d kataloghoz -At <<'COUNTS'
SELECT 'Category=' || count(*) FROM "Category";
SELECT 'Subcategory=' || count(*) FROM "Subcategory";
SELECT 'Product=' || count(*) FROM "Product";
SELECT 'Client=' || count(*) FROM "Client";
SELECT 'LocalProductPhotos=' || count(*) FROM "Product" WHERE "photo" LIKE '/uploads/%';
COUNTS
echo "BlobFiles=$(find /srv/katalog-hoz/shared/uploads -type f | wc -l)"
echo "PendingUpgrades=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)"
echo "Firewall=$(ufw status | head -n 1)"
curl -fsS https://catalog.almatytovar.kz/ >/dev/null
curl -fsS https://almatytovar.kz/ >/dev/null
for_ai_html=$(curl -fsS https://almatytovar.kz/for-ai)
grep -q 'Официальная справочная страница' <<<"$for_ai_html"
llms_text=$(curl -fsS https://almatytovar.kz/llms.txt)
grep -q 'Almaty.tovar — оптовые хозяйственные товары' <<<"$llms_text"
company_json=$(curl -fsS https://almatytovar.kz/company.json)
grep -q '"pricesIncludeVat":true' <<<"$company_json"
echo 'HTTPS_AND_AI_ENDPOINTS=OK'
journalctl -u katalog-hoz -b -p err --no-pager
