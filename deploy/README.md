# ABSlider deployment contract

`compose.yml` is shared by Production and Development. Isolation comes from a
different Compose project name, environment file, loopback ports and
project-scoped volumes for each environment.

Production and Development must use separate secret files stored outside the
repository. Do not reuse database, MinIO, JWT, admin or email credentials
between environments.

Frontend variables are compiled into the image. Build a separate frontend
image for each public API URL:

```sh
docker build \
  --build-arg VITE_API_BASE_URL=https://slides-api.sbltcup.dev/api/v1 \
  --build-arg VITE_ENABLE_EMAIL_VERIFICATION=true \
  --build-arg "RELEASE_SHA=$RELEASE_SHA" \
  --build-arg RELEASE_ENVIRONMENT=production \
  --tag "abslider-client:${RELEASE_SHA}-production" \
  client
```

The client image exposes the compiled provenance at `/version.json`. The server
receives the same `RELEASE_SHA` and `RELEASE_ENVIRONMENT` at runtime and exposes
them through `/api/v1/version` and its health responses. Public smoke checks
reject a release if the two images do not report the requested commit and
environment.

Start an environment through the trusted wrapper and pass only immutable
registry digest references. The example below is illustrative; Jenkins obtains
the exact values from its archived release manifest:

```sh
/opt/abslider/bin/deploy-abslider \
  production \
  "$RELEASE_SHA" \
  "$CLIENT_DIGEST_REF" \
  "$SERVER_DIGEST_REF"
```

Only the frontend, backend and MinIO API bind to host loopback. Host Nginx owns
public ports 80/443 and must proxy the corresponding domain to those loopback
ports. MongoDB, Redis and the MinIO console are not published.

## Jenkins deployment wrapper

`bin/deploy-abslider` is the reviewed source for the deployment wrapper used by
`Jenkinsfile.release`. Install it as
`/opt/abslider/bin/deploy-abslider` with owner `root:root` and mode `0755`.
Install this Compose file as `/opt/abslider/shared/compose.yml`, also owned by
`root:root`. The `abslider-deploy` agent can write only release state under
`/opt/abslider/releases`; it cannot modify the wrapper or Compose contract.

The wrapper expects these root-owned, `abslider-deploy` group-readable files
outside the repository (mode `0640`):

- `/opt/abslider/shared/develop.env`
- `/opt/abslider/shared/production.env`

Start from `env/develop.env.example` or `env/production.env.example`. The secret
files contain runtime settings only; they must not define `ABSLIDER_*_IMAGE`,
`RELEASE_SHA` or `RELEASE_ENVIRONMENT`. Jenkins passes immutable digest
references and release provenance to the wrapper, which writes a non-secret,
mode `0600` release manifest under `/opt/abslider/releases/<environment>/`.

Install `bin/smoke-abslider` as `/opt/abslider/bin/smoke-abslider`, owned by
`root:root` with mode `0755`. It checks public HTTPS, release provenance,
readiness dependencies, CORS policy, MinIO health and HTTP-to-HTTPS redirects.
The wrapper updates the `current` symlink only after both internal and public
checks pass. A failed deployment automatically restores the previous release;
if no previous release exists, it stops the failed candidate.

The files in `nginx/` are HTTP-only bootstrap templates. Replace the example
files with the matching environment template, verify `nginx -t`, then let
Certbot install the HTTPS directives after all three DNS records point to the
target VPS. Never expose MongoDB, Redis or the MinIO console publicly.

Do not add `jenkins-builder` or `abslider-deploy` to the host `docker` group.
Each uses a separate rootless Docker daemon: the builder daemon handles image
build/publish, while the deploy daemon runs application Compose projects. The
deploy agent executes the fixed root-owned wrapper directly as
`abslider-deploy`; Jenkins receives no sudo rule and no rootful Docker access.

Before publishing a release, run the non-mutating source contract checks:

```sh
deploy/tests/contract.sh
```

They validate shell syntax, environment/SHA/digest rejection and Compose
rendering for both environments. Actual candidate, rollback and public smoke
tests still require an isolated runtime and valid DNS/TLS.
