#!/usr/bin/env bash
set -Eeuo pipefail

echo '[nginx sites]'
find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f -> %l\n' | sort

echo '[server names and listeners]'
nginx -T 2>/dev/null | grep -E '^[[:space:]]*(listen|server_name|ssl_certificate|return 30[1278])' || true

echo '[certificates]'
certbot certificates 2>/dev/null | grep -E 'Certificate Name:|Domains:|Expiry Date:|Certificate Path:' || true

echo '[canonical URL]'
grep '^SITE_URL=' /etc/katalog-hoz.env || true

echo '[local host routing]'
for host in almatytovar.kz www.almatytovar.kz catalog.almatytovar.kz; do
  printf '%s http=%s https=' "$host" "$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $host" http://127.0.0.1/)"
  curl -k -sS -o /dev/null -w '%{http_code}\n' --resolve "$host:443:127.0.0.1" "https://$host/"
done
