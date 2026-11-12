### Description

`@decaf-ts/nest-template` is the starting point for a [NestJS](https://nestjs.com) backend built on decaf-ts. Create a repository from it, replace the demo models with your own, and you get:

- **A REST API per model**, with OpenAPI. [`@decaf-ts/for-nest`](https://github.com/decaf-ts/for-nest) generates a controller for every model registered with the persistence adapter: CRUD, bulk operations, queries (`listBy`, `findBy`, `paginateBy`, `find`, ...), aggregations and prepared statements, all documented in Swagger (`/docs`).
- **Keycloak authentication** (`@decaf-ts/integrations/nest`). Bearer tokens are verified against the realm's JWKS. User, organization, roles and namespaces are extracted from the token and bound to the request context, so `@createdBy`/`@updatedBy` and the logs know who is calling.
- **Declarative authorization at every level**. Model roles (`@roles`), model namespaces (`@namespace`), controller config (`@controllerConfig({ auth })` or module-level `controllerConfig`), per-route decorators (`@Public`, `@Auth`, `@RequireRoles`, `@RequireNamespaces`) and route blocking (`@BlockOperations`).
- **Live events**. Every write is pushed over Server-Sent Events (`/events`), authenticated with the same Keycloak handler, in broadcast or subscription mode. Decaf frontends consume them through `@decaf-ts/for-http`'s `HttpAdapter` and the standard `Observer` API.
- **Zero infrastructure to start**. Persistence uses decaf's in-memory adapter, so the app and its whole e2e suite run without a database or a Keycloak (the tests embed a JWKS-serving Keycloak stand-in). A `docker-compose` with a pre-provisioned Keycloak realm is included for local development.
- **End-to-end tests through the HttpAdapter**. Every model, every permission rule and the events API are exercised over HTTP with `@decaf-ts/for-http`'s `AxiosHttpAdapter`, the same client a decaf frontend uses.

#### The demo domain

A small coffee shop. Each model demonstrates a different way of protecting the generated API:

| Model / route | Endpoint | Protection | How |
|---|---|---|---|
| `Category` | `/category` | public, read-only | `@controllerConfig({ auth: { public: true } })` + `@BlockOperations([...])` (seeded server-side) |
| `Product` | `/product` | role `catalog-manager` on every route | model-level `@roles([...])`; aggregations and bulk enabled by `@controllerConfig` |
| `Order` | `/customer-order` | role `customer`; no DELETE | module-level `controllerConfig: { Order: { auth: { roles } } }` + `@BlockOperations([DELETE])` |
| `Ticket` | `/ticket` | role `agent` **and** namespace `support` | `@roles([...])` + `@namespace([...])` |
| `Article` | `/article` | read: public; queries: `reader`; writes: `editor`; delete: `admin` | hand-built controller (`FromModelController.create`) decorated route by route |
| `GET /me` | `/me` | any authenticated user | `@Auth()` on a custom controller |
| `GET /reports/sales` | `/reports/sales` | role `manager` **and** namespace `sales` | `@RequireRoles` + `@RequireNamespaces`, repositories injected with `@Repository(Model)` |
| `GET /public/status` | `/public/status` | public | `@Public()` and the `/public` path prefix |
| events | `/events` | any authenticated user | `observerOptions: { authenticate: true }` |

`createdBy` (or `customer` on orders) is always the authenticated user, whatever the payload says. It is `@readonly()`, so updates cannot rewrite it.

#### Architecture

```
src/
├── main.ts                 process entrypoint (node lib/main.js)
├── bootstrap.ts            createApp(): Nest app + decaf NestBootstraper (helmet, CORS, error filter, swagger)
├── app.module.ts           AppModule.forRoot(): DecafModule (persistence, generated controllers, events) + auth + custom controllers
├── config/environment.ts   typed environment (PORT, KEYCLOAK__*, JWT__*, EVENTS__*, ...)
├── persistence/            adapter bootstrap (RAM by default) — imported before any model
├── auth/                   Keycloak auth handler, jwt service (JWKS), roles & namespaces, AuthModule
├── models/                 demo models (shareable with a frontend)
├── controllers/            custom controllers (/me, /public/status, /reports/sales, per-route Article controller)
└── seed.ts                 server-owned reference data
```

A request goes through for-nest's `AuthMiddleware`, which primes the request context from the token. Then the `AuthInterceptor` asks the **Keycloak handler** to verify the token (JWKS) and check route and model roles and namespaces. The request-to-context transformer maps the user onto the adapter flags, and finally the generated controller calls the model's `ModelService`/`Repository`. Every committed write is dispatched to the observers, including the SSE stream of each connected client.
