#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

apt-get update
apt-get upgrade --with-new-pkgs -y
apt-get clean

echo "PendingUpgrades=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)"
if [[ -f /var/run/reboot-required ]]; then
  echo 'RebootRequired=yes'
  cat /var/run/reboot-required.pkgs 2>/dev/null || true
else
  echo 'RebootRequired=no'
fi
systemctl is-active katalog-hoz nginx postgresql
df -h /
