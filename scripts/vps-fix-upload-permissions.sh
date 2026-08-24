#!/usr/bin/env bash
set -euo pipefail

image_path=/uploads/products/perchatki/hb-perchatki-40-tg-wa1-0001.webp
namei -l /srv/katalog-hoz/shared/uploads/products/perchatki/hb-perchatki-40-tg-wa1-0001.webp || true
tail -n 10 /var/log/nginx/error.log || true

chmod 755 /srv /srv/katalog-hoz /srv/katalog-hoz/shared /srv/katalog-hoz/shared/uploads
find /srv/katalog-hoz/shared/uploads -type d -exec chmod 755 {} +
find /srv/katalog-hoz/shared/uploads -type f -exec chmod 644 {} +

curl -fsS -o /dev/null -H 'Host: catalog.almatytovar.kz' "http://127.0.0.1$image_path"
echo 'Local image request: OK'
