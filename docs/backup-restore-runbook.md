# ABSlider Production backup and restore runbook

## Scope and recovery objectives

The Production backup covers:

- a compressed MongoDB logical archive;
- a Redis RDB snapshot;
- MinIO object data copied while the backend and MinIO are briefly paused;
- the Production runtime environment, Compose file, Nginx configuration and
  current immutable release manifest;
- a SHA-256 manifest for every staged artifact.

Restic encrypts the payload before it is stored in Azure Blob Storage. The
target objectives are an RPO of 24 hours and an RTO of 2 hours. The timer keeps
7 daily, 4 weekly and 6 monthly snapshots.

Jenkins Home is outside this runbook. It is protected by the separate Jenkins
controller backup procedure.

## Security contract

- Azure account keys and SAS tokens are not used.
- The VM system-assigned Managed Identity has `Storage Blob Data Contributor`
  only on container `abslider-restic`.
- The Restic repository is `azure:abslider-restic:/production`.
- The verified Production deploy UID is `1001`; its rootless Docker socket is
  `/run/user/1001/docker.sock`. Re-run `id -u abslider-deploy` before installing
  on a rebuilt VM instead of assuming the UID is portable.
- `/etc/abslider-backup/restic-password` is `root:root` mode `0600` and must
  also be escrowed in the team's password manager. Losing it makes every
  snapshot unrecoverable.
- Runtime secrets are present only in the root-only staging directory and the
  encrypted Restic repository. Staging is removed after every run.
- Backup takes a shared lock on the deployment lock. A deploy therefore cannot
  change the active release while artifacts are captured.
- The systemd unit uses `ProtectHome=read-only`. `ProtectHome=yes` must not be
  used because it also hides `/run/user`, making the Production rootless Docker
  socket unavailable to the backup process.

## Installation

Install the reviewed files as root:

```sh
install -o root -g root -m 0755 \
  deploy/bin/backup-abslider \
  /opt/abslider/bin/backup-abslider
install -o root -g root -m 0755 \
  deploy/bin/restore-abslider \
  /opt/abslider/bin/restore-abslider
install -d -o root -g root -m 0700 /opt/abslider/backups
install -d -o root -g root -m 0700 /etc/abslider-backup
install -o root -g root -m 0600 \
  deploy/systemd/abslider-backup.env.example \
  /etc/abslider-backup/backup.env
install -o root -g root -m 0644 \
  deploy/systemd/abslider-backup.service \
  /etc/systemd/system/abslider-backup.service
install -o root -g root -m 0644 \
  deploy/systemd/abslider-backup.timer \
  /etc/systemd/system/abslider-backup.timer
```

The Ubuntu `0.16.4-2ubuntu0.24.04.3` package was tested on the Production VM and
returned `invalid backend` for an `azure:` repository. Install the reviewed
official upstream `0.19.1` binary in `/usr/local/bin`; the backup wrapper pins
that version and places `/usr/local/bin` before `/usr/bin`.

```sh
apt-get update
apt-get install --yes bzip2 ca-certificates curl
RESTIC_DOWNLOAD_DIR="$(mktemp -d)"
cd "$RESTIC_DOWNLOAD_DIR"
curl --fail --location --remote-name \
  https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2
printf '%s  %s\n' \
  f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c \
  restic_0.19.1_linux_amd64.bz2 | sha256sum --check
bunzip2 restic_0.19.1_linux_amd64.bz2
install -o root -g root -m 0755 \
  restic_0.19.1_linux_amd64 \
  /usr/local/bin/restic
/usr/local/bin/restic version
```

Generate a strong repository password directly on the VM and store a separate
copy in the team password manager. Never paste the password into Git, Jenkins,
Jira or chat.

```sh
umask 077
openssl rand -base64 48 > /etc/abslider-backup/restic-password
```

Initialize the repository once. `set -a` is required so every value loaded from
the file is exported to Restic:

```sh
set -a
. /etc/abslider-backup/backup.env
set +a
unset AZURE_ACCOUNT_KEY AZURE_ACCOUNT_SAS AZURE_FORCE_CLI_CREDENTIAL
restic init
restic cat config >/dev/null
```

## First backup and scheduling

Run the first backup manually and inspect its journal before enabling the timer:

```sh
systemctl daemon-reload
systemctl start abslider-backup.service
systemctl status abslider-backup.service --no-pager
journalctl -u abslider-backup.service --since today --no-pager
systemctl enable --now abslider-backup.timer
systemctl list-timers abslider-backup.timer --all
```

The service is a timer-triggered oneshot. Its normal resting state is
`inactive (dead)` and it does not need to be enabled directly. The timer must
remain `enabled` and `active (waiting)`. Because `RandomizedDelaySec=10m`, the
actual trigger can be up to ten minutes after 02:30 Asia/Bangkok.

Success requires all of the following in the same run:

- Mongo archive, Redis snapshot and MinIO copy completed;
- every line in `SHA256SUMS` returned `OK`;
- Restic created a snapshot;
- retention/prune completed;
- `restic check` completed;
- the wrapper printed `BACKUP_SUCCEEDED` and systemd reported success.

## Non-destructive archive restore

List snapshots and restore one into a new drill directory:

```sh
set -a
. /etc/abslider-backup/backup.env
set +a
unset AZURE_ACCOUNT_KEY AZURE_ACCOUNT_SAS AZURE_FORCE_CLI_CREDENTIAL
restic snapshots --host abslider-production-01 --tag abslider,production
/opt/abslider/bin/restore-abslider latest drill-YYYYMMDD
```

The wrapper validates every restored file against `SHA256SUMS`. It never writes
to live MongoDB, Redis or MinIO. A task cannot be marked restore-tested until the
validated artifacts are imported into isolated temporary containers and their
content is queried successfully.

On hosts running Linux kernel 6.19 through 7.0.13, MongoDB documents a known
TCMalloc incompatibility. The Production Compose definition already applies
`GLIBC_TUNABLES=glibc.pthread.rseq=1`; use the same environment value for an
isolated MongoDB restore container. The long-term fix is upgrading the host to
kernel 7.0.14 or later.

After recording a successful drill, remove its plaintext directory. It contains
the restored Production environment file and can always be recreated from the
encrypted Restic snapshot.

## Initial Production validation record

On 2026-09-25, snapshot `a3891f45` passed all of the following on isolated
containers without Production ports, networks or volumes:

- MongoDB restored five collections and four documents with zero failures;
- Redis validated its RDB checksum and loaded one key;
- MinIO opened the restored data and successfully queried the empty `media`
  bucket;
- the plaintext drill directory was deleted after a sanitized success event was
  written to the system journal.

The first timer-originated run completed on 2026-09-26 Asia/Bangkok. Systemd
recorded `LastTriggerUSec=Fri 2026-09-25 19:39:02 UTC`, `Result=success` and
`ExecMainStatus=0`. The wrapper emitted `BACKUP_SUCCEEDED` at 19:39:06 UTC only
after retention pruning and `restic check` completed. The timer remained
`enabled` and `active`, scheduled its next run, and the public readiness endpoint
reported MongoDB, Redis and MinIO as healthy after the backup.

## Incident restore boundary

Do not restore over live volumes during a drill. A destructive recovery needs:

1. an incident record and explicit Production approval;
2. a fresh backup attempt or a documented reason it cannot run;
3. the exact snapshot ID and checksum proof;
4. Production writers stopped;
5. restore into new volumes first, followed by health and content checks;
6. an explicit cutover decision and a recorded rollback point.

Blob soft delete is a provider safety net, not a substitute for a verified
Restic snapshot or an isolated restore rehearsal.
