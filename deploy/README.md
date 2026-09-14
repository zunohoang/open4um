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
  --tag abslider-client:<git-sha>-production \
  client
```

Start an environment only after replacing mutable local tags with immutable
registry digests in its secret environment file:

```sh
docker compose \
  --project-name abslider-production \
  --env-file /opt/abslider/shared/production.env \
  --file deploy/compose.yml \
  up --detach --wait
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

The secret files contain the runtime settings from `.env.example`, except the
two `ABSLIDER_*_IMAGE` entries. Jenkins passes immutable digest references and
the wrapper writes a non-secret release manifest under
`/opt/abslider/releases/<environment>/`.

Do not add `jenkins-builder` or `abslider-deploy` to the host `docker` group.
Each uses a separate rootless Docker daemon: the builder daemon handles image
build/publish, while the deploy daemon runs application Compose projects. The
deploy agent executes the fixed root-owned wrapper directly as
`abslider-deploy`; Jenkins receives no sudo rule and no rootful Docker access.
