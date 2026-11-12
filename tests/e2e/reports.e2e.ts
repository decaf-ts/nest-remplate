/**
 * `GET /reports/sales`: custom controller protected by `@RequireRoles("manager")` AND
 * `@RequireNamespaces("sales")`, reading through `@Repository(Model)`-injected repositories.
 *
 * Each e2e file boots exactly one backend: decaf keeps process-wide registries (adapters,
 * services such as the `jwt` verifier), so one application per Jest module registry.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, repositoryFor, uid } from "./harness/client";
import { Users } from "./harness/users";
import { Order, OrderStatus, Product } from "../../src/index";

describe("GET /reports/sales — @RequireRoles + @RequireNamespaces custom controller", () => {
  let backend: Backend;

  async function report(token?: string) {
    const res = await fetch(`${backend.baseUrl}/reports/sales`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  beforeAll(async () => {
    backend = await bootBackend();
    const products = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.catalogManager) }),
      Product
    );
    await products.createAll([
      new Product({ sku: "ESP-001", name: "Espresso", category: "coffee", price: 10, stock: 100 }),
      new Product({ sku: "GRD-001", name: "Grinder", category: "equipment", price: 100, stock: 5 }),
    ]);
    const orders = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.customer) }),
      Order
    );
    await orders.createAll([
      new Order({ id: uid("r"), productSku: "ESP-001", quantity: 3, status: OrderStatus.PLACED }),
      new Order({ id: uid("r"), productSku: "ESP-001", quantity: 2, status: OrderStatus.SHIPPED }),
      new Order({ id: uid("r"), productSku: "GRD-001", quantity: 1, status: OrderStatus.PLACED }),
      new Order({ id: uid("r"), productSku: "GRD-001", quantity: 9, status: OrderStatus.CANCELLED }),
    ]);
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("computes revenue for a manager scoped to the sales namespace (namespace via `namespace:` role)", async () => {
    const { status, body } = await report(await backend.keycloak.token(Users.salesManager));
    expect(status).toBe(200);
    expect(body).toEqual({
      orders: 3,
      revenue: 150,
      lines: [
        { sku: "ESP-001", quantity: 5, revenue: 50 },
        { sku: "GRD-001", quantity: 1, revenue: 100 },
      ],
    });
  });

  it("rejects a manager outside the sales namespace", async () => {
    const { status, body } = await report(await backend.keycloak.token(Users.managerWithoutNamespace));
    expect(status).toBe(403);
    expect(body.error).toContain("Missing required namespaces");
  });

  it("rejects a non-manager and anonymous callers", async () => {
    const asCustomer = await report(await backend.keycloak.token(Users.customer));
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body.error).toContain("Missing required roles");
    expect((await report()).status).toBe(401);
  });
});
