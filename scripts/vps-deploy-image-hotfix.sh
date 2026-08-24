#!/usr/bin/env bash
set -Eeuo pipefail
app_root=/srv/katalog-hoz
archive=/home/ubuntu/katalog-b2b-hotfix.tar.gz
release_id="image-hotfix-$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$app_root/releases/$release_id"
old_release=$(readlink -f "$app_root/current")
test -f "$archive"
test -n "$old_release"

rollback() {
  ln -sfn "$old_release" "$app_root/current"
  systemctl restart katalog-hoz || true
}
trap 'echo "Hotfix failed; restoring previous release" >&2; rollback' ERR

echo '[1/4] Extracting hotfix release'
install -d -o kataloghoz -g kataloghoz "$release_dir"
tar -xzf "$archive" -C "$release_dir"
chown -R kataloghoz:kataloghoz "$release_dir"

echo '[2/4] Installing and building'
runuser -u kataloghoz -- /bin/bash -s -- "$release_dir" <<'APP'
set -Eeuo pipefail
release_dir=$1
set -a
source /etc/katalog-hoz.env
set +a
cd "$release_dir"
npm ci --no-audit --no-fund
./node_modules/.bin/prisma migrate status
npm run build
npm prune --omit=dev --no-audit --no-fund
APP

echo '[3/4] Switching release'
ln -sfn "$release_dir" "$app_root/current"
systemctl restart katalog-hoz
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3000/api/catalog-config >/dev/null

echo '[4/4] Preserving source and health result'
install -o root -g root -m 600 "$archive" "$app_root/shared/backups/katalog-source-$release_id.tar.gz"
rm -f -- "$archive"
echo "release=$release_id"
echo "previous_release=$old_release"
echo "service=$(systemctl is-active katalog-hoz)"
echo "http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
trap - ERR
