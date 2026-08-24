#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo '[1/7] Configuring 2 GiB swap'
if ! swapon --noheadings --show=NAME | grep -qx '/swapfile'; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
  fi
  chmod 600 /swapfile
  file /swapfile | grep -q 'swap file' || mkswap /swapfile
  swapon /swapfile
fi
if ! grep -Eq '^/swapfile[[:space:]]' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo '[2/7] Installing Ubuntu packages'
apt-get update
apt-get install -y \
  apt-transport-https \
  build-essential \
  ca-certificates \
  certbot \
  curl \
  git \
  gnupg \
  nginx \
  postgresql \
  postgresql-contrib \
  python3-certbot-nginx \
  rsync \
  ufw \
  unzip

echo '[3/7] Installing Node.js 24 LTS from NodeSource'
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt-get install -y nodejs
rm -f /tmp/nodesource_setup.sh

echo '[4/7] Creating the application account and directories'
if ! id -u kataloghoz >/dev/null 2>&1; then
  useradd \
    --system \
    --create-home \
    --home-dir /srv/katalog-hoz \
    --shell /usr/sbin/nologin \
    kataloghoz
fi
install -d -m 755 -o kataloghoz -g kataloghoz \
  /srv/katalog-hoz \
  /srv/katalog-hoz/releases \
  /srv/katalog-hoz/shared \
  /srv/katalog-hoz/shared/backups \
  /srv/katalog-hoz/shared/uploads \
  /srv/katalog-hoz/shared/uploads/products

echo '[5/7] Enabling PostgreSQL and Nginx'
systemctl enable --now postgresql
systemctl enable --now nginx

echo '[6/7] Enabling firewall after allowing SSH and web traffic'
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo '[7/7] Verifying installed services'
node --version
npm --version
psql --version
nginx -v
free -h
df -h /
ufw status verbose
systemctl is-active postgresql
systemctl is-active nginx
