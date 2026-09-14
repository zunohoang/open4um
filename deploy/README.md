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
