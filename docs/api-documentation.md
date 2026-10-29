# Backend API documentation

Run backend commands with the repository Node version (`.nvmrc`) and its required
npm version. Install with `npm ci` in `server`, configure the normal ignored
backend environment, then run `npm run dev`. Open `/api-docs` on that backend.
`/docs` and `/swagger` redirect there; `/api-docs/openapi.json` serves the spec.
The UI uses the same backend origin and `/api/v1`, including behind HTTPS proxies.

Use Authorize with a valid bearer access token. Authorization is not persisted
across reloads. Try it out sends real requests: mutation, email and AI endpoints
have real effects and may consume provider quota or application credits.

`server/src/docs/buildOpenApi.ts` combines actual Zod request validators with
response contracts and an audited operation catalog. The current develop checkout
has 45 API operations. Route scanning rejects undocumented operations and avoids
publishing operations absent from a checkout. Credit configuration and role
constraints follow backend validation; JSON export is documented as JSON with its
actual inline fallback, not as server-side PDF rendering.

After changing routes, validators or response contracts:

```sh
cd server
npm run docs:generate
npm run docs:check
npm run build
npm run test:unit
```

Commit the generated `src/docs/swagger.json` with the source. The unit test checks
route coverage, generated-spec drift, security, envelopes and HTTP documentation
routes. Response contract descriptions still require review when implementation
changes: generation is not proof of endpoint correctness. The UI loads local
assets, disables the remote Swagger validator and does not persist bearer tokens.

This feature must be merged and deployed before hosted development serves it.
The documentation UI presents requests/responses; the separate Postman/Selenium
reports provide assertion and execution evidence. A build pass establishes neither
live endpoint behavior nor test execution coverage.
