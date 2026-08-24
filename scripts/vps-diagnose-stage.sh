#!/usr/bin/env bash
set -u

if test -d /srv/katalog-hoz/staging-pwa/.next; then echo 'stage_dir=yes'; else echo 'stage_dir=no'; fi
if test -f /etc/katalog-hoz-pwa-stage.env; then echo 'stage_env=yes'; else echo 'stage_env=no'; fi
if test -f /home/ubuntu/katalog-pwa-stage.tar.gz; then echo 'archive=yes'; else echo 'archive=no'; fi
echo "stage_service=$(systemctl is-active katalog-hoz-stage 2>/dev/null || true)"
curl -sS -o /dev/null -w 'stage_http=%{http_code}\n' http://127.0.0.1:3001/ || true
systemctl --no-pager --full status katalog-hoz-stage 2>&1 | tail -n 12
