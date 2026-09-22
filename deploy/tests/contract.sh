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

extract_function() {
  local function_name="$1"

  sed -n "/^${function_name}() {/,/^}/p" "$deploy_script"
}

bash -n "$deploy_script" "$smoke_script"
grep -Fx 'set -Eeuo pipefail' "$deploy_script" >/dev/null ||
  fail 'deploy wrapper must inherit ERR traps inside functions'

normalizer_source="$(extract_function normalize_registry_reference)"
verifier_source="$(extract_function verify_pulled_digest)"
port_guard_source="$(extract_function assert_unpublished_port)"
[[ -n "$normalizer_source" ]] || fail 'normalize_registry_reference function was not found'
[[ -n "$verifier_source" ]] || fail 'verify_pulled_digest function was not found'
[[ -n "$port_guard_source" ]] || fail 'assert_unpublished_port function was not found'

(
  eval "$normalizer_source"
  eval "$verifier_source"

  mock_repo_digest="${client_digest_ref#docker.io/}"

  docker() {
    if [[ "$*" == *'--format'* ]]; then
      printf '%s\n' "$mock_repo_digest"
    fi
  }

  fail() {
    printf 'FAIL: %s\n' "$*" >&2
    return 1
  }

  verify_pulled_digest "$client_digest_ref" ||
    fail 'digest verification rejected Docker Hub canonical name'

  mock_repo_digest="$client_digest_ref"
  verify_pulled_digest "$client_digest_ref" ||
    fail 'digest verification rejected fully qualified Docker Hub name'

  mock_repo_digest="ducchert87/open4um-server@${client_digest_ref##*@}"
  if verify_pulled_digest "$client_digest_ref" 2>/dev/null; then
    fail 'digest verification accepted a different repository'
  fi

  mock_repo_digest="ducchert87/open4um-client@${server_digest_ref##*@}"
  if verify_pulled_digest "$client_digest_ref" 2>/dev/null; then
    fail 'digest verification accepted a different digest'
  fi
)

(
  eval "$port_guard_source"

  mock_container_id='0123456789abcdef'
  mock_port_bindings='null'

  compose_with_manifest() {
    printf '%s\n' "$mock_container_id"
  }

  docker() {
    printf '%s\n' "$mock_port_bindings"
  }

  assert_unpublished_port manifest.env mongo 27017 ||
    fail 'unpublished Docker port was rejected'

  mock_port_bindings='[{"HostIp":"127.0.0.1","HostPort":"4203"}]'
  if assert_unpublished_port manifest.env mongo 27017 2>/dev/null; then
    fail 'published Docker port was accepted'
  fi

  mock_container_id=''
  mock_port_bindings='null'
  if assert_unpublished_port manifest.env mongo 27017 2>/dev/null; then
    fail 'missing service container was accepted'
  fi
)

if grep -Eq 'port (mongo 27017|redis 6379|minio 9001)' "$deploy_script"; then
  fail 'private-port checks must not depend on Docker Compose port output'
fi

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
