#!/usr/bin/env bash
set -euo pipefail

systemctl show katalog-hoz --property=ExecStart --no-pager
ss -lntp | grep ':3000'
