#!/usr/bin/env bash
set -Eeuo pipefail

expected_archive_sha256=${1:?Pass the expected archive SHA-256 as the first argument}
archive=/home/ubuntu/katalog-pwa-stage.tar.gz
runner_dir=$(mktemp -d)

cleanup() {
  rm -rf -- "$runner_dir"
}
trap cleanup EXIT

tar -xzf "$archive" -C "$runner_dir" \
  ./scripts/vps-stage-pwa-reminder.sh \
  ./scripts/vps-promote-pwa-reminder.sh
bash -n "$runner_dir/scripts/vps-stage-pwa-reminder.sh"
bash -n "$runner_dir/scripts/vps-promote-pwa-reminder.sh"

sudo bash "$runner_dir/scripts/vps-stage-pwa-reminder.sh" "$expected_archive_sha256"
sudo bash "$runner_dir/scripts/vps-promote-pwa-reminder.sh"
