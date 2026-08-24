#!/usr/bin/env bash
set -euo pipefail

sed -i \
  's#^ExecStart=/usr/bin/npm start$#ExecStart=/usr/bin/npm start -- --hostname 127.0.0.1#' \
  /etc/systemd/system/katalog-hoz.service
systemctl daemon-reload
systemctl restart katalog-hoz

for _ in $(seq 1 30); do
  if curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1/ >/dev/null; then
    break
  fi
  sleep 2
done
curl -fsS -H 'Host: catalog.almatytovar.kz' http://127.0.0.1/ >/dev/null

nginx -t
echo "App=$(systemctl is-active katalog-hoz)"
echo "Nginx=$(systemctl is-active nginx)"
echo "PostgreSQL=$(systemctl is-active postgresql)"
echo "DBBackupTimer=$(systemctl is-active katalog-hoz-backup.timer)"
echo "CertbotTimer=$(systemctl is-active certbot.timer)"
echo "DBBackupTimerEnabled=$(systemctl is-enabled katalog-hoz-backup.timer)"
echo "CertbotTimerEnabled=$(systemctl is-enabled certbot.timer)"
echo "AppListen=$(ss -lntp | awk '$4 ~ /127[.]0[.]0[.]1:3000$/ {print $4}')"
echo "LatestBackup=$(find /srv/katalog-hoz/shared/backups -maxdepth 1 -type f -name 'postgresql-*.dump' -printf '%f %s bytes\n' | sort | tail -n 1)"
echo "AdminCredentialsMode=$(stat -c '%a %U:%G' /root/katalog-hoz-admin.txt)"
free -h
df -h /
journalctl -u katalog-hoz --since '-5 minutes' -p err --no-pager
