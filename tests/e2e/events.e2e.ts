/**
 * Live events (SSE) — default broadcast mode, authenticated with the Keycloak handler.
 *
 * Clients are `AxiosHttpAdapter`s (as a decaf frontend would use) observing models through
 * `RestService.observe()`. Every write performed through the REST API — by any user —
 * is pushed to every connected, authenticated client.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, repositoryFor, sleep, uid } from "./harness/client";
import { connected, EventListener, RawSse, serverStreams } from "./harness/events";
import { Users } from "./harness/users";
import { Order, OrderStatus, Product, Ticket, TicketPriority } from "../../src/index";

describe("Live events — broadcast mode", () => {
  let backend: Backend;
  let listeners: EventListener[] = [];
  let products: ReturnType<typeof repositoryFor<Product>>;
  let orders: ReturnType<typeof repositoryFor<Order>>;

  const listener = async (persona: keyof typeof Users) => {
    const l = new EventListener(backend.host, { token: await backend.keycloak.token(Users[persona]) });
    listeners.push(l);
    return l;
  };

  const product = (sku: string) =>
    new Product({ sku, name: `Product ${sku}`, category: "coffee", price: 4, stock: 1 });

  beforeAll(async () => {
    backend = await bootBackend();
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

  describe("stream authentication", () => {
    it("rejects anonymous connections with 401", async () => {
      const sse = new RawSse(`${backend.baseUrl}/events`);
      expect((await sse.response).status).toBe(401);
      sse.close();
    });

    /**
     * Verification of a token that LOOKS valid (well-formed, decodable) is asynchronous
     * (JWKS signature check), and on the SSE route the response headers can be flushed before
     * it fails: the stream is then rejected with a single `error` frame instead of a 401.
     * Either way it never carries data — which is what is asserted here.
     */
    it.each([
      ["an invalid signature", { forgeSignature: true }],
      ["an expired token", { expiresIn: "-1m" }],
    ] as const)("never streams data to %s", async (_label, tokenOptions) => {
      const token = await backend.keycloak.token(Users.admin, tokenOptions);
      for (let attempt = 0; attempt < 2; attempt++) {
        const sse = new RawSse(`${backend.baseUrl}/events`, { Authorization: `Bearer ${token}` });
        const { status } = await sse.response;
        await sleep(300);
        await products.create(product(uid("BADTOKEN").toUpperCase()));
        await sleep(500);
        sse.close();
        expect(sse.messages).toHaveLength(0);
        if (status !== 401) {
          expect(status).toBe(200);
          expect(sse.frames.map((f) => f.event)).toEqual(["error"]);
        }
      }
    });

    it("accepts any authenticated user (no role required) and streams [table, operation, id, ...] frames", async () => {
      const token = await backend.keycloak.token(Users.nobody);
      const sse = new RawSse(`${backend.baseUrl}/events`, { Authorization: `Bearer ${token}` });
      expect((await sse.response).status).toBe(200);
      await sleep(300);
      const sku = uid("RAW").toUpperCase();
      await products.create(product(sku));
      const started = Date.now();
      while (!sse.messages.some((m) => m[2] === sku) && Date.now() - started < 10000) await sleep(25);
      const frame = sse.messages.find((m) => m[2] === sku)!;
      expect(frame.slice(0, 3)).toEqual(["Product", "create", sku]);
      sse.close();
    });
  });

  describe("HttpAdapter observers", () => {
    it("receive create, update and delete performed through the API by another user", async () => {
      const customer = (await listener("customer")).observe(Product);
      await connected([customer]);

      const sku = uid("EVT").toUpperCase();
      await products.create(product(sku));
      await customer.waitFor("Product", "create", sku);

      await products.update(new Product({ ...(await products.read(sku)), stock: 7 }));
      await customer.waitFor("Product", "update", sku);

      await products.delete(sku);
      await customer.waitFor("Product", "delete", sku);

      expect(customer.of("Product").map((e) => e.operation)).toEqual(["create", "update", "delete"]);
    });

    it("bulk writes are delivered as one event carrying every id", async () => {
      const l = (await listener("reader")).observe(Product);
      await connected([l]);
      const skus = [uid("B1").toUpperCase(), uid("B2").toUpperCase()];
      await products.createAll(skus.map(product));
      await l.waitFor("Product", "create", skus[1]);
      const bulk = l.of("Product", "create").find((e) => Array.isArray(e.id));
      expect(bulk?.id).toEqual(skus);
    });

    it("each observer only gets events for the model it observes", async () => {
      const productWatcher = (await listener("reader")).observe(Product);
      const orderWatcher = (await listener("customer")).observe(Order);
      await connected([productWatcher, orderWatcher]);

      const sku = uid("MIX").toUpperCase();
      const orderId = uid("ord");
      await products.create(product(sku));
      await orders.create(new Order({ id: orderId, productSku: sku, quantity: 1, status: OrderStatus.PLACED }));

      await productWatcher.waitFor("Product", "create", sku);
      await orderWatcher.waitFor("Order", "create", orderId);
      await sleep(300);
      expect(productWatcher.events.every((e) => e.table === "Product")).toBe(true);
      expect(orderWatcher.events.every((e) => e.table === "Order")).toBe(true);
    });

    it("every connected client receives each event exactly once", async () => {
      const clients = await Promise.all(
        (["reader", "customer", "supportAgent", "nobody"] as const).map(async (p) => (await listener(p)).observe(Product))
      );
      await connected(clients);
      expect(serverStreams()).toBeGreaterThanOrEqual(clients.length);

      const created: string[] = [];
      for (let i = 0; i < 3; i++) {
        const sku = uid(`ONCE${i}`).toUpperCase();
        created.push(sku);
        await products.create(product(sku));
      }
      for (const client of clients)
        for (const sku of created) await client.waitFor("Product", "create", sku);
      await sleep(500); // let any duplicate show up
      for (const client of clients) {
        const keys = client.of("Product", "create").map((e) => e.id as string);
        expect(keys.sort()).toEqual([...created].sort());
      }
    });

    it("events from models the listener cannot access over REST are still broadcast", async () => {
      // the events API authenticates the stream, it does not apply model roles to frames
      const customer = (await listener("customer")).observe(Ticket);
      await connected([customer]);
      const tickets = repositoryFor(
        httpAdapter(backend.host, { token: await backend.keycloak.token(Users.supportAgent) }),
        Ticket
      );
      const id = uid("tkt");
      await tickets.create(new Ticket({ id, subject: "Broadcast me", priority: TicketPriority.LOW }));
      await customer.waitFor("Ticket", "create", id);
    });

    it("stops receiving once the observer is removed", async () => {
      const l = (await listener("reader")).observe(Product);
      await connected([l]);
      const first = uid("STOP").toUpperCase();
      await products.create(product(first));
      await l.waitFor("Product", "create", first);

      l.stop();
      await sleep(300);
      const second = uid("STOP").toUpperCase();
      await products.create(product(second));
      await sleep(800);
      expect(l.has("Product", "create", second)).toBe(false);
    });
  });
});
