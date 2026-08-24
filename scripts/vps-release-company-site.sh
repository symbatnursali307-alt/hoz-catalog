#!/usr/bin/env bash
set -Eeuo pipefail

expected_archive_sha256=${1:?Pass expected archive SHA-256}
archive=/home/ubuntu/katalog-site-stage.tar.gz
runner_dir=$(mktemp -d)

cleanup() {
  rm -rf -- "$runner_dir"
}
trap cleanup EXIT

tar -xzf "$archive" -C "$runner_dir" \
  scripts/vps-stage-company-site.sh \
  scripts/vps-promote-company-site.sh
bash -n "$runner_dir/scripts/vps-stage-company-site.sh"
bash -n "$runner_dir/scripts/vps-promote-company-site.sh"
sudo -n bash "$runner_dir/scripts/vps-stage-company-site.sh" "$expected_archive_sha256"
sudo -n bash "$runner_dir/scripts/vps-promote-company-site.sh"
