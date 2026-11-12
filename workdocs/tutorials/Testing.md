## Testing

```bash
npm test               # everything (unit + e2e)
npm run test:unit      # tests/unit
npm run test:e2e       # tests/e2e
npm run coverage       # + coverage and html/junit reports under workdocs/reports
```

No infrastructure is needed. The app is ESM (NestJS 12 is ESM-only), so Jest runs with `--experimental-vm-modules`, which the npm scripts set. Set `TEST_LOG_LEVEL=info` (or `debug`) to see the application logs.

### The e2e harness (`tests/e2e/harness`)

- **`keycloak.ts`**: an in-process Keycloak stand-in. It serves an RS256 JWKS on Keycloak's own path (`/realms/<realm>/protocol/openid-connect/certs`) and issues Keycloak-shaped access tokens: `iss`, `aud`, `azp`, `realm_access`, `resource_access`, `namespaces`. It can also forge a bad signature or issue an expired token. The app is booted with `KEYCLOAK__URL` pointing at it, so tokens go through the production JWKS verification path.
- **`backend.ts`**: boots the real application (`createApp`, the same factory as `main.ts`) on an ephemeral port.
- **`client.ts`**: `BearerHttpAdapter`, an `AxiosHttpAdapter` adding the bearer token to REST calls and to the SSE stream (`eventHeaderResolver`), and `repositoryFor(adapter, Model)` → `RestService`.
- **`events.ts`**: `EventListener` (HttpAdapter observers recording the events they receive) and `RawSse` (raw SSE reader for HTTP-level assertions).
- **`users.ts`**: the personas (roles and namespaces) used by the suites.

| Suite | Covers |
|---|---|
| `auth.e2e.ts` | public routes, OpenAPI, `/me` (`@Auth()`), token verification (missing, forged, expired, garbage), oauth2-proxy header |
| `category.e2e.ts` | public reads, blocked writes (single + bulk) |
| `product.e2e.ts` | CRUD, bulk, queries, aggregations, validation and type checks (422), conflicts (409), URL/payload pk mismatch (400), missing records (404), `createdBy` integrity, model roles, client roles, error classes rebuilt on the client |
| `order.e2e.ts` | module-level `controllerConfig` roles, blocked DELETE, `createdBy`/`updatedBy` |
| `ticket.e2e.ts` | model roles **and** namespaces |
| `article.e2e.ts` | per-route `@Public`/`@RequireRoles` on a hand-built model controller |
| `reports.e2e.ts` | `@RequireRoles` + `@RequireNamespaces` custom controller, namespace via `namespace:` role |
| `events.e2e.ts` | SSE auth and delivery to HttpAdapter observers (broadcast mode) |
| `events-subscription.e2e.ts` | subscription mode |

Conventions:

- **One backend per test file.** decaf keeps process-wide registries (adapters, services such as the `jwt` verifier). Jest isolates modules per file, not per `describe`.
- **Import models through `src/index.js`** (or after `src/persistence`). Adapter decorations must be registered before the models are decorated.
- **Use `RestService`.** It is the client-side repository: it leaves handlers (`createdBy`, timestamps) and validation to the server.
- In-process, for-http shares one SSE connection per URL. The harness gives every simulated client its own connection, the way separate browser tabs work.

### Error contract

The server answers every failure with the status of a decaf error and a body whose `error` field names it (`[ForbiddenError][403] Missing required roles ...`). The `HttpAdapter` rebuilds that same error on the client, so the suites assert on the error class and its `code` (`statusOf` in the harness):

| Status | Error | When |
|---|---|---|
| 400 | `BadRequestError` | the pk in the URL does not match the payload's `@pk` |
| 401 | `AuthorizationError` | missing, forged, expired or unverifiable token |
| 403 | `ForbiddenError` | authenticated, but missing a required role or namespace |
| 404 | `NotFoundError` | the record does not exist |
| 406 | `NotAcceptableError` | no such route, e.g. operations removed with `@BlockOperations` |
| 409 | `ConflictError` | the record already exists |
| 422 | `ValidationError` | the payload fails model validation, including a value of the wrong type |
