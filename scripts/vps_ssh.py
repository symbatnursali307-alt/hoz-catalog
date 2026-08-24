#!/usr/bin/env python3
"""Small SSH/SFTP helper for VPS recovery and deployment.

Passwords are requested interactively and are never accepted as CLI arguments.
The first server key is stored locally using trust-on-first-use.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import json
import os
import pathlib
import re
import secrets
import shlex
import sys
import time

import paramiko


def fingerprint(key: paramiko.PKey) -> str:
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode("ascii").rstrip("=")


def connect(args: argparse.Namespace) -> tuple[paramiko.SSHClient, str]:
    password = getpass.getpass("SSH password: ")
    known_hosts = pathlib.Path(args.known_hosts).resolve()
    known_hosts.parent.mkdir(parents=True, exist_ok=True)
    known_hosts.touch(exist_ok=True)

    client: paramiko.SSHClient | None = None
    for attempt in range(3):
        client = paramiko.SSHClient()
        client.load_host_keys(str(known_hosts))
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=args.host,
                port=args.port,
                username=args.user,
                password=password,
                look_for_keys=False,
                allow_agent=False,
                timeout=15,
                banner_timeout=20,
                auth_timeout=15,
            )
            break
        except (paramiko.SSHException, EOFError, ConnectionResetError):
            client.close()
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
    assert client is not None
    client.save_host_keys(str(known_hosts))
    key = client.get_transport().get_remote_server_key()
    print(f"Connected. Host key {key.get_name()} {fingerprint(key)}", file=sys.stderr)
    return client, password


def run_command(client: paramiko.SSHClient, command: str) -> int:
    _stdin, stdout, stderr = client.exec_command(command, get_pty=False, timeout=None)
    out = stdout.read()
    err = stderr.read()
    if out:
        sys.stdout.buffer.write(out)
    if err:
        sys.stderr.buffer.write(err)
    return stdout.channel.recv_exit_status()


def run_script(
    client: paramiko.SSHClient,
    password: str,
    script_path: str,
    sudo: bool,
    check: bool,
) -> int:
    script = pathlib.Path(script_path).read_bytes()
    transport = client.get_transport()
    channel = transport.open_session()
    # The provisioned VPS grants this account passwordless sudo. Using -n also
    # guarantees that a password can never be mistaken for shell input.
    bash_flags = "-n" if check else "-se"
    command = f"sudo -n bash {bash_flags}" if sudo else f"bash {bash_flags}"
    channel.exec_command(command)
    channel.sendall(script)
    if not script.endswith(b"\n"):
        channel.sendall(b"\n")
    channel.shutdown_write()

    stdout = channel.makefile("rb", -1).read()
    stderr = channel.makefile_stderr("rb", -1).read()
    if stdout:
        sys.stdout.buffer.write(stdout)
    if stderr:
        sys.stderr.buffer.write(stderr)
    return channel.recv_exit_status()


def upload(client: paramiko.SSHClient, local: str, remote: str) -> int:
    local_path = pathlib.Path(local).resolve()
    if not local_path.is_file():
        raise FileNotFoundError(local_path)
    with client.open_sftp() as sftp:
        sftp.put(str(local_path), remote)
    print(f"Uploaded {local_path.name} ({local_path.stat().st_size} bytes)")
    return 0


def upload_many(client: paramiko.SSHClient, remote_dir: str, files: list[str]) -> int:
    with client.open_sftp() as sftp:
        try:
            sftp.mkdir(remote_dir)
        except OSError:
            pass
        for local in files:
            local_path = pathlib.Path(local).resolve()
            if not local_path.is_file():
                raise FileNotFoundError(local_path)
            remote = remote_dir.rstrip('/') + '/' + local_path.name
            sftp.put(str(local_path), remote)
            print(f"Uploaded {local_path.name} ({local_path.stat().st_size} bytes)")
    return 0


def download(client: paramiko.SSHClient, remote: str, local: str) -> int:
    local_path = pathlib.Path(local).resolve()
    local_path.parent.mkdir(parents=True, exist_ok=True)
    with client.open_sftp() as sftp:
        sftp.get(remote, str(local_path))
    print(f"Downloaded {local_path.name} ({local_path.stat().st_size} bytes)")
    return 0


def download_many(client: paramiko.SSHClient, remote_dir: str, local_dir: str, files: list[str]) -> int:
    local_path = pathlib.Path(local_dir).resolve()
    local_path.mkdir(parents=True, exist_ok=True)
    with client.open_sftp() as sftp:
        for name in files:
            if pathlib.PurePosixPath(name).name != name:
                raise ValueError(f"Expected a file name, got {name!r}")
            remote = remote_dir.rstrip('/') + '/' + name
            target = local_path / name
            sftp.get(remote, str(target))
            print(f"Downloaded {target.name} ({target.stat().st_size} bytes)")
    return 0


def set_env(client: paramiko.SSHClient, env_path: str, names: list[str]) -> int:
    """Update selected remote env values without exposing them in commands or logs."""
    if not names:
        raise ValueError("At least one environment variable name is required")
    if any(not re.fullmatch(r"[A-Z][A-Z0-9_]*", name) for name in names):
        raise ValueError("Environment variable names must use uppercase letters, digits and underscores")

    updates: dict[str, str] = {}
    for name in names:
        value = getpass.getpass(f"{name}: ")
        if not value:
            raise ValueError(f"{name} cannot be empty")
        updates[name] = value

    remote_patch = f"/home/ubuntu/.katalog-env-update-{secrets.token_hex(8)}.json"
    with client.open_sftp() as sftp:
        with sftp.open(remote_patch, "wb") as handle:
            handle.write(json.dumps(updates).encode("utf-8"))
        sftp.chmod(remote_patch, 0o600)

    remote_code = r'''
import json
import os
import pathlib
import shlex
import sys
import tempfile

env_path = pathlib.Path(sys.argv[1])
patch_path = pathlib.Path(sys.argv[2])
try:
    updates = json.loads(patch_path.read_text(encoding="utf-8"))
    original = env_path.read_text(encoding="utf-8").splitlines()
    output = []
    seen = set()
    for line in original:
        key = line.split("=", 1)[0] if "=" in line else ""
        if key in updates:
            if key not in seen:
                output.append(f"{key}={shlex.quote(str(updates[key]))}")
                seen.add(key)
        else:
            output.append(line)
    for key, value in updates.items():
        if key not in seen:
            output.append(f"{key}={shlex.quote(str(value))}")

    current = env_path.stat()
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=env_path.parent, delete=False) as handle:
        handle.write("\n".join(output) + "\n")
        temp_path = pathlib.Path(handle.name)
    os.chown(temp_path, current.st_uid, current.st_gid)
    os.chmod(temp_path, current.st_mode & 0o777)
    os.replace(temp_path, env_path)
finally:
    patch_path.unlink(missing_ok=True)
'''
    encoded = base64.b64encode(remote_code.encode("utf-8")).decode("ascii")
    command = (
        "sudo -n python3 -c "
        + shlex.quote(f"import base64;exec(base64.b64decode('{encoded}'))")
        + " " + shlex.quote(env_path)
        + " " + shlex.quote(remote_patch)
    )
    result = run_command(client, command)
    if result == 0:
        print("Updated environment variables: " + ", ".join(names))
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument(
        "--known-hosts",
        default=os.path.join(".tools", "known_hosts"),
    )
    subparsers = parser.add_subparsers(dest="action", required=True)

    run = subparsers.add_parser("run")
    run.add_argument("command")

    script = subparsers.add_parser("run-script")
    script.add_argument("script")
    script.add_argument("--sudo", action="store_true")
    script.add_argument("--check", action="store_true")

    put = subparsers.add_parser("upload")
    put.add_argument("local")
    put.add_argument("remote")

    put_many = subparsers.add_parser("upload-many")
    put_many.add_argument("remote_dir")
    put_many.add_argument("files", nargs='+')

    get = subparsers.add_parser("download")
    get.add_argument("remote")
    get.add_argument("local")

    get_many = subparsers.add_parser("download-many")
    get_many.add_argument("remote_dir")
    get_many.add_argument("local_dir")
    get_many.add_argument("files", nargs='+')

    env = subparsers.add_parser("set-env")
    env.add_argument("env_path")
    env.add_argument("names", nargs='+')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    client, password = connect(args)
    try:
        if args.action == "run":
            return run_command(client, args.command)
        if args.action == "run-script":
            return run_script(client, password, args.script, args.sudo, args.check)
        if args.action == "upload":
            return upload(client, args.local, args.remote)
        if args.action == "upload-many":
            return upload_many(client, args.remote_dir, args.files)
        if args.action == "download":
            return download(client, args.remote, args.local)
        if args.action == "download-many":
            return download_many(client, args.remote_dir, args.local_dir, args.files)
        if args.action == "set-env":
            return set_env(client, args.env_path, args.names)
        raise RuntimeError(f"Unknown action: {args.action}")
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
