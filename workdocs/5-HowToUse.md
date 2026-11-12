### How to Use

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Calling the API](#calling-the-api)
- [Adding your own models](#adding-your-own-models)
- [Protecting the API](./workdocs/tutorials/Authentication.md)
- [Live events](./workdocs/tutorials/Live%20Events.md)
- [Testing](./workdocs/tutorials/Testing.md)
- [Developer guide (scripts, CI/CD, releases, IDE)](./workdocs/tutorials/For%20Developers.md)

#### Quick start

Requirements: Node.js >= 20, npm >= 10, Docker (optional, for Keycloak). The app is an ES module (`"type": "module"`), like NestJS 12.

```bash
npm install
cp .env.example .env

# a Keycloak with the `decaf` realm, demo roles and demo users (password = username)
npm run keycloak:up            # http://localhost:8180 (admin/admin)

npm run start:dev              # http://localhost:3000 — swagger at /docs
```

Or run the whole stack in containers: `docker compose -f docker/docker-compose.yml --profile api up -d --build`.

Demo users (realm `decaf`, client `decaf-backend`):

| user | roles |
|---|---|
| `catalog` | `catalog-manager` |
| `customer` | `customer` |
| `agent` | `agent`, `namespace:support` |
| `reader` / `editor` / `admin` | `reader` / `+editor` / `+admin` |
| `manager` | `manager`, `namespace:sales` |

```bash
TOKEN=$(curl -s http://localhost:8180/realms/decaf/protocol/openid-connect/token \
  -d grant_type=password -d client_id=decaf-backend -d username=catalog -d password=catalog | jq -r .access_token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/me
curl -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"sku":"ESP-001","name":"Espresso beans","category":"coffee","price":12.5,"stock":40}' \
  http://localhost:3000/product
curl -N -H "Authorization: Bearer $TOKEN" http://localhost:3000/events   # live events
```

#### Configuration

All settings come from the environment (`.env` is loaded by `npm run start:dev`). See [`.env.example`](./.env.example).

`AppEnvironment` (`src/config/environment.ts`) is a decaf-ts `Environment`, available everywhere: each setting is read from `process.env` when accessed, named after its path (`camelCase` → `UPPER_SNAKE`, nested keys joined with `__`), and falls back to the default. Booleans are `true`/`false`.

| Variable | Default | Description |
|---|---|---|
| `PORT` / `HOST` | `3000` / `0.0.0.0` | http listener |
| `CORS_ORIGINS` | `*` | comma separated allowed origins |
| `SWAGGER` | `true` | swagger UI on `/docs`, OpenAPI json on `/docs-json` |
| `SEED` | `true` | seeds the demo categories |
| `KEYCLOAK__URL` | — | Keycloak base url; tokens are verified against `<url>/realms/<realm>/protocol/openid-connect/certs` |
| `KEYCLOAK__REALM` | `decaf` | realm issuing the tokens |
| `KEYCLOAK__CLIENT_ID` | `decaf-backend` | this backend's client id |
| `JWT__VERIFY_URL` | — | explicit JWKS url (overrides the Keycloak-derived one) |
| `JWT__SECRET` | — | HS256 shared secret, used only when no JWKS url is set |
| `JWT__CLOCK_TOLERANCE_SECONDS` | `5` | accepted clock skew |
| `JWT__ALLOW_DECODE_ONLY` | `false` | **development only**: accept tokens without verifying signatures |
| `LOG_ACCESS` | `false` | OCSF-style access logs (class_uid 3001/3002) |
| `EVENTS__ENABLED` | `true` | live events endpoint |
| `EVENTS__PATH` | `/events` | SSE endpoint path |
| `EVENTS__SUBSCRIPTION_MODE` | `false` | clients receive only the tables they subscribe to |
| `EVENTS__AUTHENTICATE` | `true` | run the Keycloak handler on the stream and subscription endpoints |

With no `KEYCLOAK__URL`, `JWT__VERIFY_URL` or `JWT__SECRET`, every authenticated request is rejected, and a warning is logged at boot.

#### Calling the API

From another decaf application (a frontend, another service), use `@decaf-ts/for-http` with the same model classes as `src/models` (this repository ships a Docker image, not an npm package, so share the models through your own models package or copy them):

```ts
import { AxiosHttpAdapter, RestService } from "@decaf-ts/for-http";
import { Product } from "./models"; // the same classes as src/models

const adapter = new AxiosHttpAdapter({
  protocol: "https",
  host: "api.example.com",
  eventsListenerPath: "/events",
  eventHeaderResolver: () => ({ Authorization: `Bearer ${getToken()}` }), // SSE + subscriptions
});
// REST calls: add the bearer token, e.g. by overriding `request` (see tests/e2e/harness/client.ts)

const products = new RestService(adapter, Product);
await products.create(new Product({ sku: "ESP-001", name: "Espresso", category: "coffee", price: 12, stock: 4 }));
const cheapest = await products.listBy("price", "asc");
const stop = products.observe({ refresh: async (table, op, id) => console.log(table, op, id) });
```

#### Adding your own models

1. Create the model in `src/models` (decorate it with `@uses(PersistenceFlavour)`, `@table`, `@model()`, `@pk`, `@column`, validation decorators, ...). Export it from `src/models/index.ts`.
2. Choose how it is protected: `@roles`, `@namespace`, `@controllerConfig({ auth })`, the module-level `controllerConfig`, or a hand-built controller ([guide](./workdocs/tutorials/Authentication.md)).
3. That's it: the controller, OpenAPI documentation and events are generated. Add an e2e suite under `tests/e2e` (copy `product.e2e.ts`).

To move to a real database, swap the RAM adapter in `src/persistence/index.ts` for another decaf adapter (e.g. `@decaf-ts/for-typeorm`, `@decaf-ts/for-nano`, `@decaf-ts/for-fabric`) together with its request-to-context transformer, and update `src/persistence/flavour.ts`.
