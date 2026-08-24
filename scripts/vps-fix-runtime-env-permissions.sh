#!/usr/bin/env bash
set -Eeuo pipefail

runtime_env=/etc/katalog-hoz.env
test -f "$runtime_env"
chown root:kataloghoz "$runtime_env"
chmod 640 "$runtime_env"
runuser -u kataloghoz -- test -r "$runtime_env"
test "$(stat -c '%U:%G %a' "$runtime_env")" = 'root:kataloghoz 640'
echo 'RUNTIME_ENV_PERMISSIONS=PASS'
