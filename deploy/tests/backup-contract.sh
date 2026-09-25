#!/usr/bin/env bash
set -euo pipefail

readonly repository_root="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
  pwd
)"
readonly backup_script="${repository_root}/deploy/bin/backup-abslider"
readonly restore_script="${repository_root}/deploy/bin/restore-abslider"
readonly service_unit="${repository_root}/deploy/systemd/abslider-backup.service"
readonly timer_unit="${repository_root}/deploy/systemd/abslider-backup.timer"
readonly env_example="${repository_root}/deploy/systemd/abslider-backup.env.example"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

bash -n "$backup_script" "$restore_script"

for required in \
  'mongodump' \
  'redis-cli SAVE' \
  'compose pause server minio' \
  'sha256sum --check SHA256SUMS' \
  'restic backup' \
  'restic forget' \
  '--keep-daily 7' \
  '--keep-weekly 4' \
  '--keep-monthly 6' \
  'restic check'; do
  grep -F -- "$required" "$backup_script" >/dev/null ||
    fail "backup contract is missing: ${required}"
done
grep -F "expected_restic_version='0.19.1'" "$backup_script" >/dev/null ||
  fail 'backup must pin the reviewed upstream Restic version'
grep -F "expected_restic_version='0.19.1'" "$restore_script" >/dev/null ||
  fail 'restore must pin the reviewed upstream Restic version'

grep -F 'flock --shared --wait 300' "$backup_script" >/dev/null ||
  fail 'backup must coordinate with the deployment lock'
for script in "$backup_script" "$restore_script"; do
  grep -F \
    'unset AZURE_ACCOUNT_KEY AZURE_ACCOUNT_SAS AZURE_FORCE_CLI_CREDENTIAL' \
    "$script" >/dev/null ||
    fail "Azure credentials are not constrained in ${script}"
done
grep -F 'azure:abslider-restic:/production' "$backup_script" >/dev/null ||
  fail 'backup must pin the Production repository path'
grep -F 'Live MongoDB, Redis and MinIO were not modified.' "$restore_script" >/dev/null ||
  fail 'restore wrapper must remain non-destructive by default'
grep -F "stat --format='%U:%G' \"\$RESTIC_PASSWORD_FILE\"" "$restore_script" >/dev/null ||
  fail 'restore must verify Restic password ownership'
grep -F "stat --format='%a' \"\$RESTIC_PASSWORD_FILE\"" "$restore_script" >/dev/null ||
  fail 'restore must verify Restic password permissions'

grep -F 'EnvironmentFile=/etc/abslider-backup/backup.env' "$service_unit" >/dev/null ||
  fail 'systemd service must load the root-owned environment file'
grep -F 'ProtectSystem=strict' "$service_unit" >/dev/null ||
  fail 'systemd service must protect the host filesystem'
grep -F 'ProtectHome=read-only' "$service_unit" >/dev/null ||
  fail 'systemd service must keep home read-only without hiding the rootless Docker socket'
if grep -Fx 'ProtectHome=yes' "$service_unit" >/dev/null; then
  fail 'ProtectHome=yes hides /run/user and breaks access to the rootless Docker socket'
fi
grep -F 'OnCalendar=*-*-* 02:30:00 Asia/Bangkok' "$timer_unit" >/dev/null ||
  fail 'timer must use an explicit Production timezone'

if grep -Eq 'AZURE_ACCOUNT_(KEY|SAS)=' "$env_example"; then
  fail 'Azure account keys and SAS tokens must not appear in the environment template'
fi
grep -Fx 'DOCKER_HOST=unix:///run/user/1001/docker.sock' "$env_example" >/dev/null ||
  fail 'backup environment must target the verified Production rootless Docker socket'

if command -v systemd-analyze >/dev/null 2>&1; then
  set +e
  verify_output="$(systemd-analyze verify "$service_unit" "$timer_unit" 2>&1)"
  verify_status="$?"
  set -e
  if [[ "$verify_status" -ne 0 ]]; then
    unexpected_output="$(
      grep -Fv \
        'Command /opt/abslider/bin/backup-abslider is not executable: No such file or directory' \
        <<<"$verify_output" || true
    )"
    [[ -z "$unexpected_output" ]] || {
      printf '%s\n' "$verify_output" >&2
      fail 'systemd unit verification failed'
    }
  fi
fi

printf 'PASS: backup source contracts\n'
