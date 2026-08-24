#!/usr/bin/env bash
set -Eeuo pipefail

disk=/dev/sda
partition=/dev/sda2

root_source=$(findmnt -n -o SOURCE /)
root_filesystem=$(findmnt -n -o FSTYPE /)
test "$root_source" = "$partition"
test "$root_filesystem" = ext4
test -b "$disk"
test -b "$partition"

disk_bytes=$(blockdev --getsize64 "$disk")
partition_bytes=$(blockdev --getsize64 "$partition")
test "$disk_bytes" -ge 40000000000

echo "BeforeDiskBytes=$disk_bytes"
echo "BeforePartitionBytes=$partition_bytes"
df -h /

if (( partition_bytes * 100 / disk_bytes < 90 )); then
  command -v growpart >/dev/null
  growpart "$disk" 2
fi

resize2fs "$partition"

new_partition_bytes=$(blockdev --getsize64 "$partition")
test "$new_partition_bytes" -gt "$partition_bytes"
test "$new_partition_bytes" -ge 38000000000

echo "AfterPartitionBytes=$new_partition_bytes"
df -h /
echo 'ROOT_VOLUME_EXPANSION=PASS'
