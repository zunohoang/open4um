#!/usr/bin/env bash
set -euo pipefail

readonly repository_root="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
  pwd
)"
readonly deploy_script="${repository_root}/deploy/bin/deploy-abslider"
readonly smoke_script="${repository_root}/deploy/bin/smoke-abslider"
readonly compose_file="${repository_root}/deploy/compose.yml"
readonly release_sha='0123456789abcdef0123456789abcdef01234567'
readonly client_digest_ref='docker.io/ducchert87/open4um-client@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
readonly server_digest_ref='docker.io/ducchert87/open4um-server@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

expect_failure() {
  local expected="$1"
  local output
  local status
  shift

  set +e
  output="$("$@" 2>&1)"
  status="$?"
  set -e

  [[ "$status" -ne 0 ]] || fail "command unexpectedly succeeded: $*"
  grep -F "$expected" <<<"$output" >/dev/null || {
    printf '%s\n' "$output" >&2
    fail "expected error was not found: ${expected}"
  }
}

bash -n "$deploy_script" "$smoke_script"

expect_failure 'usage: deploy-abslider' "$deploy_script"
expect_failure \
  'unsupported environment' \
  "$deploy_script" \
  staging \
  "$release_sha" \
  "$client_digest_ref" \
  "$server_digest_ref"
expect_failure \
  'commit SHA must contain exactly 40 lowercase hex characters' \
  "$deploy_script" \
  develop \
  latest \
  "$client_digest_ref" \
  "$server_digest_ref"
expect_failure \
  'invalid client digest reference' \
  "$deploy_script" \
  develop \
  "$release_sha" \
  'docker.io/ducchert87/open4um-client:develop' \
  "$server_digest_ref"
expect_failure \
  'invalid client digest reference' \
  "$deploy_script" \
  develop \
  "$release_sha" \
  'docker.io/other/open4um-client@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
  "$server_digest_ref"

expect_failure 'usage: smoke-abslider' "$smoke_script"
expect_failure 'unsupported environment' "$smoke_script" staging "$release_sha"
expect_failure \
  'commit SHA must contain exactly 40 lowercase hex characters' \
  "$smoke_script" \
  develop \
  latest

for release_environment in develop production; do
  RELEASE_ENVIRONMENT="$release_environment" \
  RELEASE_SHA="$release_sha" \
  ABSLIDER_CLIENT_IMAGE="$client_digest_ref" \
  ABSLIDER_SERVER_IMAGE="$server_digest_ref" \
    docker compose \
      --project-name "abslider-${release_environment}" \
      --env-file "${repository_root}/deploy/env/${release_environment}.env.example" \
      --file "$compose_file" \
      config --quiet
done

printf 'PASS: deployment source contracts\n'
