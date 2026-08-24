#!/usr/bin/env bash
set -euo pipefail

server_ip=46.247.41.103
for domain in almatytovar.kz www.almatytovar.kz catalog.almatytovar.kz; do
  if ! getent ahostsv4 "$domain" | awk '{print $1}' | grep -qx "$server_ip"; then
    echo "$domain does not resolve to $server_ip from the VPS" >&2
    exit 1
  fi
done

certbot --nginx \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  --keep-until-expiring \
  -d almatytovar.kz \
  -d www.almatytovar.kz \
  -d catalog.almatytovar.kz

nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
curl -fsS https://catalog.almatytovar.kz/ >/dev/null
echo 'HTTPS request: OK'
certbot certificates
systemctl is-active certbot.timer
