#!/usr/bin/env bash
set -Eeuo pipefail

stage_db=kataloghoz_quality_stage
stage_env=/etc/katalog-hoz-quality-stage.env
stage_unit=/etc/systemd/system/katalog-hoz-stage.service

echo '[1/3] Verifying production before cleanup'
test "$(systemctl is-active katalog-hoz)" = active
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)" = 200
test "$stage_db" != kataloghoz

echo '[2/3] Removing the temporary isolated staging database'
systemctl disable --now katalog-hoz-stage.service 2>/dev/null || true
if runuser -u postgres -- psql -Atc "SELECT 1 FROM pg_database WHERE datname='$stage_db'" | grep -qx 1; then
  runuser -u postgres -- dropdb --force "$stage_db"
fi

echo '[3/3] Removing temporary staging configuration'
rm -f -- "$stage_env" "$stage_unit"
systemctl daemon-reload
test "$(systemctl is-active katalog-hoz)" = active
echo 'QUALITY_STAGE_CLEANUP=PASS'
