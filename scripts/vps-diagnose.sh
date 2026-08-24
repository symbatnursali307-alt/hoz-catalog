#!/usr/bin/env bash
set -euo pipefail

printf 'HOST=%s\n' "$(hostname)"
cat /etc/os-release
uname -r
id
free -h
df -hT /
swapon --show
ss -lntup
printf 'node='
command -v node || true
printf 'nginx='
command -v nginx || true
printf 'psql='
command -v psql || true
if sudo -n true 2>/dev/null; then
  echo 'sudo_nopass=yes'
else
  echo 'sudo_nopass=no'
fi
