/**
 * Order: route-level roles from the MODULE-level `controllerConfig`
 * (`{ Order: { auth: { roles: ["customer"] } } }`), no DELETE (`@BlockOperations`),
 * and the authenticated user always recorded as the customer.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, rejection, repositoryFor, statusOf, uid } from "./harness/client";
import { Users } from "./harness/users";
import { Order, OrderStatus } from "../../src/index";

describe("Order API — module-level controllerConfig roles", () => {
  let backend: Backend;
  let orders: ReturnType<typeof repositoryFor<Order>>;
  let otherOrders: ReturnType<typeof repositoryFor<Order>>;

  const order = (id: string, extra: Partial<Order> = {}) =>
    new Order({ id, productSku: "ESP-001", quantity: 2, status: OrderStatus.PLACED, ...extra });

  beforeAll(async () => {
    backend = await bootBackend();
    orders = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.customer) }),
      Order
    );
    otherOrders = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.otherCustomer) }),
      Order
    );
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("lets a customer (client role) place, read and update an order", async () => {
    const id = uid("ord");
    const placed = await orders.create(order(id, { notes: "ring twice" }));
    expect(placed.customer).toBe(Users.customer.email);
    expect(placed.status).toBe(OrderStatus.PLACED);

    const read = await orders.read(id);
    expect(read.quantity).toBe(2);

    const shipped = await orders.update(new Order({ ...read, status: OrderStatus.SHIPPED }));
    expect(shipped.status).toBe(OrderStatus.SHIPPED);
    expect(shipped.customer).toBe(Users.customer.email);
    expect(shipped.updatedBy).toBe(Users.customer.email);
  });

  it("always records the authenticated user as the customer", async () => {
    const placed = await orders.create(order(uid("ord"), { customer: "someone@else.test" } as any));
    expect(placed.customer).toBe(Users.customer.email);
  });

  it("records the updating user in updatedBy", async () => {
    const id = uid("ord");
    await orders.create(order(id));
    const updated = await otherOrders.update(new Order({ ...(await otherOrders.read(id)), quantity: 3 }));
    expect(updated.customer).toBe(Users.customer.email);
    expect(updated.updatedBy).toBe(Users.otherCustomer.email);
  });

  it("validates the order (quantity range, status options)", async () => {
    for (const bad of [order(uid("ord"), { quantity: 0 }), order(uid("ord"), { status: "lost" })]) {
      const error = await rejection(() => orders.create(bad));
      expect(statusOf(error)).toBe(422);
    }
  });

  it("supports bulk create and queries", async () => {
    const ids = [uid("bulk"), uid("bulk")];
    const created = await orders.createAll(ids.map((id) => order(id, { quantity: 1 })));
    expect(created).toHaveLength(2);
    const placed = await orders.findBy("status", OrderStatus.PLACED);
    expect(placed.map((o) => o.id)).toEqual(expect.arrayContaining(ids));
  });

  it("does not expose DELETE, single or bulk (@BlockOperations)", async () => {
    const id = uid("ord");
    await orders.create(order(id));
    for (const call of [() => orders.delete(id), () => orders.deleteAll([id])]) {
      const error = await rejection(call);
      // blocked operations have no route: the decaf exception filter answers 406 (NotAcceptableError)
      expect(statusOf(error)).toBe(406);
    }
    expect((await orders.read(id)).id).toBe(id);
  });

  it("rejects users without the customer role, and anonymous users", async () => {
    const asManager = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.catalogManager) }),
      Order
    );
    const anonymous = repositoryFor(httpAdapter(backend.host), Order);
    for (const [repo, expected] of [
      [asManager, 403],
      [anonymous, 401],
    ] as const) {
      const error = await rejection(() => repo.create(order(uid("ord"))));
      expect(statusOf(error)).toBe(expected);
      const listError = await rejection(() => repo.listBy("id", "asc" as any));
      expect(statusOf(listError)).toBe(expected);
    }
  });
});
