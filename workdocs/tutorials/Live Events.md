## Live events (SSE)

Every committed write (create, update, delete, single or bulk) on a model of the observed flavours is pushed to the connected clients over Server-Sent Events.

### Server

Configured in `src/app.module.ts` through `DecafModule.forRootAsync({ observerOptions })`:

| Option | Env | Default | Meaning |
|---|---|---|---|
| `enableObserverEvents` | `EVENTS__ENABLED` | `true` | exposes the SSE endpoint |
| `observerApiPath` | `EVENTS__PATH` | `/events` | endpoint path |
| `observerFlavours` | — | the persistence flavour | adapter flavours whose events are streamed |
| `authenticate` | `EVENTS__AUTHENTICATE` | `true` | runs the Keycloak handler on the stream and the subscription endpoints. Any valid token is accepted (no role is required) |
| `subscriptionMode` | `EVENTS__SUBSCRIPTION_MODE` | `false` | `false`: broadcast every event to every stream. `true`: a stream only receives the tables its client subscribed to |

Each event is one SSE `message` frame whose data is a JSON array `[table, operation, id, ...]`. For bulk operations `id` is the array of ids.

Subscription mode adds:

- `POST <path>/subscribe` with `{ "topics": ["Product", ...] }` → `201 { topics, fingerprint }`
- `POST <path>/unsubscribe` with `{ "topics": [...] }`

Clients are identified by a *fingerprint*: the authenticated user plus the `x-correlation-id` header, so every tab/device keeps its own stream and subscriptions. A newer stream from the same client takes over the older one.

> The events API authenticates the stream. It does **not** apply model roles to the frames: an authenticated client is told that *something* changed (table, operation, id) and must still be authorized to read the record through the REST API.

### Client (`@decaf-ts/for-http`)

```ts
const adapter = new AxiosHttpAdapter({
  protocol: "https",
  host: "api.example.com",
  eventsListenerPath: "/events",
  eventsSubscription: false, // true when the backend runs in subscription mode
  eventHeaderResolver: () => ({ Authorization: `Bearer ${getToken()}` }), // resolved on every (re)connection
  eventsReconnect: { delayMs: 1000, maxDelayMs: 30000 },
});

const products = new RestService(adapter, Product);
const stop = products.observe({
  refresh: async (table, operation, id) => {
    // e.g. reload the list, or re-read `id`
  },
});
// later
stop();
```

- An observer of a model is only notified for that model's table.
- In subscription mode the adapter subscribes to the observed tables automatically.
- The connection is opened with the first observer and closed with the last.

### Tests

`tests/e2e/events.e2e.ts` (broadcast) and `tests/e2e/events-subscription.e2e.ts` cover:

- stream authentication;
- create, update, delete and bulk delivery to HttpAdapter observers;
- per-model filtering;
- exactly-once delivery to several clients;
- unsubscribing;
- subscription-mode topic filtering.
