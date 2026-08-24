#!/usr/bin/env bash
set -Eeuo pipefail

server_ip=46.247.41.103
main_domain=almatytovar.kz
www_domain=www.almatytovar.kz
catalog_domain=catalog.almatytovar.kz
nginx_site=/etc/nginx/sites-available/katalog-hoz
runtime_env=/etc/katalog-hoz.env
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir=/srv/katalog-hoz/shared/backups/domain-switch-$timestamp

for domain in "$main_domain" "$www_domain" "$catalog_domain"; do
  getent ahostsv4 "$domain" | awk '{print $1}' | grep -qx "$server_ip"
done

install -d -o root -g root -m 700 "$backup_dir"
install -o root -g root -m 600 "$nginx_site" "$backup_dir/nginx-katalog-hoz.conf"
install -o root -g root -m 600 "$runtime_env" "$backup_dir/katalog-hoz.env"

rollback() {
  echo 'Domain switch failed; restoring Nginx and runtime environment' >&2
  install -o root -g root -m 644 "$backup_dir/nginx-katalog-hoz.conf" "$nginx_site" || true
  install -o root -g root -m 600 "$backup_dir/katalog-hoz.env" "$runtime_env" || true
  nginx -t && systemctl reload nginx || true
  systemctl restart katalog-hoz || true
}
trap rollback ERR

echo '[1/6] Installing catalog-aware HTTP and HTTPS virtual host'
install -d -o www-data -g www-data -m 755 /var/www/certbot/.well-known/acme-challenge
cat > "$nginx_site" <<'NGINX'
upstream katalog_hoz_app {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name almatytovar.kz www.almatytovar.kz catalog.almatytovar.kz;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name almatytovar.kz www.almatytovar.kz catalog.almatytovar.kz;

    ssl_certificate /etc/letsencrypt/live/almatytovar.kz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/almatytovar.kz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;

    location /uploads/ {
        alias /srv/katalog-hoz/shared/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /_next/static/ {
        proxy_cache_valid 200 30d;
        proxy_pass http://katalog_hoz_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://katalog_hoz_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX
chown root:root "$nginx_site"
chmod 644 "$nginx_site"
nginx -t
systemctl reload nginx

echo '[2/6] Expanding the existing certificate to the catalog subdomain'
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --non-interactive \
  --agree-tos \
  --cert-name almatytovar.kz \
  --expand \
  -d almatytovar.kz \
  -d www.almatytovar.kz \
  -d catalog.almatytovar.kz
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer

echo '[3/6] Updating the canonical application URL'
if grep -q '^SITE_URL=' "$runtime_env"; then
  sed -i 's|^SITE_URL=.*|SITE_URL=https://catalog.almatytovar.kz|' "$runtime_env"
else
  printf '\nSITE_URL=https://catalog.almatytovar.kz\n' >> "$runtime_env"
fi
chown root:kataloghoz "$runtime_env"
chmod 640 "$runtime_env"
systemctl restart katalog-hoz

echo '[4/6] Waiting for the application'
for _ in $(seq 1 30); do
  if curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/catalog-config >/dev/null; then
    break
  fi
  sleep 2
done
curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1:3000/api/catalog-config >/dev/null

echo '[5/6] Verifying HTTPS and canonical feed links'
test "$(curl -sS -o /dev/null -w '%{http_code}' https://catalog.almatytovar.kz/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://catalog.almatytovar.kz/admin/login)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://almatytovar.kz/)" = 200
curl -fsS -o /tmp/katalog-domain-switch-feed.csv https://catalog.almatytovar.kz/api/meta-feed.csv
grep -q 'https://catalog.almatytovar.kz' /tmp/katalog-domain-switch-feed.csv
rm -f -- /tmp/katalog-domain-switch-feed.csv
grep -qx 'SITE_URL=https://catalog.almatytovar.kz' "$runtime_env"

echo '[6/6] Reporting the final state'
cert_domains=$(openssl x509 -in /etc/letsencrypt/live/almatytovar.kz/fullchain.pem -noout -ext subjectAltName | tr '\n' ' ')
echo "backup_dir=$backup_dir"
echo "site_url=https://catalog.almatytovar.kz"
echo "catalog_http=$(curl -sS -o /dev/null -w '%{http_code}' http://catalog.almatytovar.kz/)"
echo "catalog_https=$(curl -sS -o /dev/null -w '%{http_code}' https://catalog.almatytovar.kz/)"
echo "main_https=$(curl -sS -o /dev/null -w '%{http_code}' https://almatytovar.kz/)"
echo "certificate=$cert_domains"
echo "service=$(systemctl is-active katalog-hoz)"
echo "nginx=$(systemctl is-active nginx)"
trap - ERR
