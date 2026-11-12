## Authentication & authorization

### How a request is authenticated

1. `AuthMiddleware` (for-nest) *primes* the request context: it decodes the token and binds user, roles and namespaces early, so logs carry them even if the request fails later.
2. `AuthInterceptor` (for-nest) runs on every route protected by `@Auth`, `@RequireRoles` or `@RequireNamespaces`, and on every generated model controller. It calls the registered auth handler.
3. `AppAuthHandler` (`src/auth/auth.handler.ts`) extends `KeycloakNamespaceAuthHandler` from `@decaf-ts/integrations/nest`. It:
   - skips public requests (`/public/**`, `/docs`, see `PUBLIC_PATHS`);
   - reads the bearer token from `Authorization`, or from `x-auth-request-access-token` (oauth2-proxy);
   - verifies it with the `jwt` service (`src/auth/jwt.service.ts`, from `@decaf-ts/crypto`) against the **Keycloak realm JWKS**: signature, `exp`, `nbf`;
   - extracts `user` (`email` → `preferred_username`), `organization` (`aud` → `azp` → realm), `roles` (realm roles plus every client's roles) and `namespaces` (the `namespaces`/`namespace` claim, plus roles named `namespace:<name>`);
   - checks route requirements and model requirements (see below);
   - binds the data to the request context. The `RamTransformer` then maps `user` onto the adapter's `UUID` flag, which `@createdBy`/`@updatedBy` read.

Failures answer `401` with the reason (`Token not found`, `Invalid token: ...`, `Missing required roles: ...`, `Missing required namespaces: ...`). In production (`NODE_ENV=production`) the message is masked.

### The options, from coarse to fine

| Where | What | Example in the template |
|---|---|---|
| model | `@roles([...])` (core): every generated route of the model requires the roles | `Product`, `Ticket` |
| model | `@namespace([...])` (`@decaf-ts/integrations/nest`): every generated route requires the namespaces | `Ticket` |
| model | `@controllerConfig({ auth: { public: true } })` (for-nest): every generated route is public | `Category` |
| model | `@controllerConfig({ auth: { roles, namespaces, skipModelRoles, skipModelNamespaces } })` | — |
| module | `DecafModule.forRootAsync({ controllerConfig: { Model: { auth } } })`: same as above, without touching the model | `Order` |
| model | `@BlockOperations([...])` (db-decorators): the routes are not generated at all, for single and bulk operations independently | `Category`, `Order` |
| module | `controllerExposure: { Model: false }`: no generated controller for the model | `Article` |
| route | `@Public()`, `@Auth(model?)`, `@RequireRoles(...)`, `@RequireNamespaces(...)` (for-nest) on custom controllers or on a hand-built model controller | `/me`, `/reports/sales`, `/public/status`, `Article` |
| events | `observerOptions.authenticate`: runs the handler on `/events` and `/events/(un)subscribe` | `/events` |

Route metadata wins over class metadata: the interceptor resolves the handler first.

Combining route roles with model roles: a generated controller is decorated with `@Auth(Model)` (model roles **and** namespaces apply) unless `controllerConfig.auth` sets `public` or `roles`. In that case the controller-level requirement replaces the model's.

### Per-route permissions on a model (Article)

Generated controllers are protected as a whole. When operations need different permissions, build the controller yourself after the persistence layer is up (see `src/controllers/article.controller.ts`):

```ts
const controller = FromModelController.create(Article);
decorate(controller, "read", Public());
decorate(controller, "create", RequireRoles("editor"));
decorate(controller, "delete", RequireRoles("admin"));
// ...remaining routes: RequireRoles("reader")
```

Hide the model from `DecafModule` (`controllerExposure: { Article: false }`) and register the controller in `AppModule.forRoot()`.

### Who wrote it

`@createdBy()` and `@updatedBy()` are filled from the authenticated user. Payload values are ignored. `@createdBy()` only runs on create, so the template pairs it with `@readonly()`: an update that tries to change the author is rejected with `422`.

### Customizing

- **Other public paths**: edit `PUBLIC_PATHS` in `src/auth/auth.handler.ts`.
- **Other claims or tenancy**: override `parseFromRequest`, `getGrantedClaims` or `normalizeClaim` in `AppAuthHandler`.
- **Extra context for the persistence layer**: override `prime()` and `ctx.accumulate({...})`, or write your own `RequestToContextTransformer`.
- **Access logs**: `LOG_ACCESS=true` emits OCSF-style `user_login` action logs. Failures are always logged.
- **Another identity provider**: implement an `AuthHandler` (`@decaf-ts/for-http/server`) and pass it to `DecafAuthModule.forRoot({ handler })`.

### Keycloak setup

`docker/keycloak/decaf-realm.json` (imported by `docker/docker-compose.yml`) shows the minimum:

- realm roles for every role used by the API, including `namespace:<name>` roles for namespaces;
- a client (`decaf-backend`) with an audience mapper, so `aud` (the *organization*) is the client id;
- demo users (password = username). **Do not use this realm in production.**

Namespaces can also be given through a `namespaces` claim (multi-valued user attribute + protocol mapper) instead of `namespace:` roles.
