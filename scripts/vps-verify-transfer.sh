#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/katalog-transfer
sha256sum katalog-source.tar.gz vercel-blob-objects.tar data.sql
stat --format='%n %s bytes' katalog-source.tar.gz vercel-blob-objects.tar data.sql
