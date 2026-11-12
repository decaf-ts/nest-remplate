/**
 * Live events (SSE) — subscription mode (`EVENTS__SUBSCRIPTION_MODE=true`).
 *
 * Clients only receive the tables they subscribed to (`POST /events/subscribe`), which the
 * HttpAdapter does automatically for the models it observes (`eventsSubscription: true`).
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, repositoryFor, sleep, uid } from "./harness/client";
import { connected, EventListener, RawSse } from "./harness/events";
import { Users } from "./harness/users";
import { Order, OrderStatus, Product } from "../../src/index";

describe("Live events — subscription mode", () => {
  let backend: Backend;
  let listeners: EventListener[] = [];
  let products: ReturnType<typeof repositoryFor<Product>>;
  let orders: ReturnType<typeof repositoryFor<Order>>;

  const listener = async (persona: keyof typeof Users) => {
    const l = new EventListener(backend.host, {
      token: await backend.keycloak.token(Users[persona]),
      eventsSubscription: true,
    });
    listeners.push(l);
    return l;
  };

  const subscribe = async (token: string | undefined, topics: string[], correlationId?: string) =>
    fetch(`${backend.baseUrl}/events/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(correlationId ? { "x-correlation-id": correlationId } : {}),
      },
      body: JSON.stringify({ topics }),
    });

  beforeAll(async () => {
    backend = await bootBackend({ EVENTS__SUBSCRIPTION_MODE: "true" });
    products = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.catalogManager) }),
      Product
    );
    orders = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.customer) }),
      Order
    );
  });

  afterEach(async () => {
    await Promise.all(listeners.map((l) => l.shutdown()));
    listeners = [];
    await sleep(100);
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("the subscription endpoint is authenticated", async () => {
    expect((await subscribe(undefined, ["Product"])).status).toBe(401);
    const res = await subscribe(await backend.keycloak.token(Users.reader), ["Product"]);
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).topics).toEqual(["Product"]);
  });

  it("HttpAdapters subscribe to the models they observe and only receive those", async () => {
    const productClient = (await listener("reader")).observe(Product);
    const orderClient = (await listener("customer")).observe(Order);
    await connected([productClient, orderClient]);
    await sleep(300); // subscription calls are issued right after the stream opens

    const sku = uid("SUB").toUpperCase();
    const orderId = uid("ord");
    await products.create(new Product({ sku, name: "Subscribed", category: "coffee", price: 2, stock: 1 }));
    await orders.create(new Order({ id: orderId, productSku: sku, quantity: 1, status: OrderStatus.PLACED }));

    await productClient.waitFor("Product", "create", sku);
    await orderClient.waitFor("Order", "create", orderId);
    await sleep(500);
    expect(productClient.events.map((e) => e.table)).toEqual(["Product"]);
    expect(orderClient.events.map((e) => e.table)).toEqual(["Order"]);
  });

  it("a stream that never subscribed receives nothing", async () => {
    const token = await backend.keycloak.token(Users.nobody);
    const sse = new RawSse(`${backend.baseUrl}/events`, {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": uid("silent"),
    });
    expect((await sse.response).status).toBe(200);
    await sleep(300);
    await products.create(new Product({ sku: uid("NS").toUpperCase(), name: "Unheard", category: "coffee", price: 2, stock: 1 }));
    await sleep(1000);
    expect(sse.messages).toHaveLength(0);
    sse.close();
  });

  it("a raw client subscribing with its correlation id receives its topics", async () => {
    const token = await backend.keycloak.token(Users.supportAgent);
    const correlationId = uid("tab");
    const sse = new RawSse(`${backend.baseUrl}/events`, {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": correlationId,
    });
    expect((await sse.response).status).toBe(200);
    expect((await subscribe(token, ["Product"], correlationId)).status).toBe(201);
    await sleep(200);

    const sku = uid("RAWSUB").toUpperCase();
    await products.create(new Product({ sku, name: "Heard", category: "coffee", price: 2, stock: 1 }));
    await orders.create(new Order({ id: uid("ord"), productSku: sku, quantity: 1, status: OrderStatus.PLACED }));
    const started = Date.now();
    while (!sse.messages.some((m) => m[2] === sku) && Date.now() - started < 10000) await sleep(25);
    await sleep(300);
    expect(sse.messages.map((m) => m[0])).toEqual(["Product"]);
    sse.close();
  });
});
