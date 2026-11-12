/**
 * Product: model-level roles (`@roles(["catalog-manager"])`) on every generated route,
 * exercised end-to-end through the HttpAdapter — CRUD, bulk, queries and aggregations.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, rejection, repositoryFor, statusOf, uid } from "./harness/client";
import { Users } from "./harness/users";
import { Product } from "../../src/index";
import { AuthorizationError, ForbiddenError } from "@decaf-ts/core";
import { BadRequestError, NotFoundError, ValidationError } from "@decaf-ts/db-decorators";
import { parseHttpError } from "@decaf-ts/for-http";

describe("Product API — model-level roles (@roles)", () => {
  let backend: Backend;
  let products: ReturnType<typeof repositoryFor<Product>>;
  let asCustomer: ReturnType<typeof repositoryFor<Product>>;
  let anonymous: ReturnType<typeof repositoryFor<Product>>;

  const product = (sku: string, extra: Partial<Product> = {}) =>
    new Product({
      sku,
      name: `Product ${sku}`,
      category: "coffee",
      price: 10,
      stock: 5,
      ...extra,
    });

  beforeAll(async () => {
    backend = await bootBackend();
    const token = await backend.keycloak.token(Users.catalogManager);
    products = repositoryFor(httpAdapter(backend.host, { token }), Product);
    asCustomer = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.customer) }),
      Product
    );
    anonymous = repositoryFor(httpAdapter(backend.host), Product);
  });

  afterAll(async () => {
    await backend?.close();
  });

  describe("CRUD as catalog-manager", () => {
    const sku = uid("CRUD").toUpperCase();

    it("creates a product and stamps createdBy/updatedBy with the token user", async () => {
      const created = await products.create(product(sku, { createdBy: "forged@evil.test" } as any));
      expect(created).toBeInstanceOf(Product);
      expect(created.sku).toBe(sku);
      expect(created.createdBy).toBe(Users.catalogManager.email);
      expect(created.updatedBy).toBe(Users.catalogManager.email);
      expect(created.createdAt).toBeDefined();
    });

    it("reads it back", async () => {
      const read = await products.read(sku);
      expect(read).toBeInstanceOf(Product);
      expect(read.name).toBe(`Product ${sku}`);
      expect(read.price).toBe(10);
    });

    it("updates it", async () => {
      const current = await products.read(sku);
      const updated = await products.update(
        new Product({ ...current, price: 12.5, stock: 3 })
      );
      expect(updated.price).toBe(12.5);
      expect(updated.stock).toBe(3);
      expect(updated.createdBy).toBe(Users.catalogManager.email);
    });

    it("rejects an update that rewrites createdBy (@readonly)", async () => {
      const current = await products.read(sku);
      const error = await rejection(() =>
        products.update(new Product({ ...current, createdBy: "forged@evil.test" }))
      );
      expect(statusOf(error)).toBe(422);
      expect((await products.read(sku)).createdBy).toBe(Users.catalogManager.email);
    });

    it("rejects invalid payloads with 422 (server-side validation)", async () => {
      const error = await rejection(() => products.create(product(uid("BAD").toUpperCase(), { price: -1 })));
      expect(statusOf(error)).toBe(422);
    });

    it("rejects duplicates with 409", async () => {
      const error = await rejection(() => products.create(product(sku)));
      expect(statusOf(error)).toBe(409);
    });

    it("deletes it", async () => {
      const deleted = await products.delete(sku);
      expect(deleted.sku).toBe(sku);
      const error = await rejection(() => products.read(sku));
      expect(statusOf(error)).toBe(404);
    });
  });

  describe("bulk operations", () => {
    const skus = [1, 2, 3].map((i) => `${uid("BULK").toUpperCase()}-${i}`);

    it("createAll / readAll / updateAll / deleteAll", async () => {
      const created = await products.createAll(skus.map((sku, i) => product(sku, { price: i + 1 })));
      expect(created.map((p) => p.sku)).toEqual(skus);
      expect(created.every((p) => p.createdBy === Users.catalogManager.email)).toBe(true);

      const read = await products.readAll(skus);
      expect(read.map((p) => p.sku).sort()).toEqual([...skus].sort());

      const updated = await products.updateAll(read.map((p) => new Product({ ...p, stock: 99 })));
      expect(updated.every((p) => p.stock === 99)).toBe(true);

      const deleted = await products.deleteAll(skus);
      expect(deleted).toHaveLength(3);
      const error = await rejection(() => products.read(skus[0]));
      expect(statusOf(error)).toBe(404);
    });
  });

  describe("queries and aggregations", () => {
    const prefix = uid("Q").toUpperCase();
    const fixtures = [
      product(`${prefix}-A`, { name: "Blend espresso", category: "coffee", price: 8, stock: 10 }),
      product(`${prefix}-B`, { name: "Blend decaf", category: "coffee", price: 6, stock: 4 }),
      product(`${prefix}-C`, { name: "Burr grinder", category: "equipment", price: 120, stock: 2 }),
    ];

    beforeAll(async () => {
      await products.createAll(fixtures);
    });

    afterAll(async () => {
      await products.deleteAll(fixtures.map((p) => p.sku));
    });

    it("listBy sorts by an attribute", async () => {
      const list = await products.listBy("price", "desc" as any);
      const ours = list.filter((p: Product) => p.sku.startsWith(prefix)).map((p: Product) => p.sku);
      expect(ours).toEqual([`${prefix}-C`, `${prefix}-A`, `${prefix}-B`]);
    });

    it("findBy filters by attribute value", async () => {
      const equipment = await products.findBy("category", "equipment");
      expect(equipment.map((p) => p.sku)).toContain(`${prefix}-C`);
      expect(equipment.every((p) => p.category === "equipment")).toBe(true);
    });

    it("findOneBy returns a single match", async () => {
      const found = await products.findOneBy("name", "Burr grinder");
      expect(found.sku).toBe(`${prefix}-C`);
    });

    it("find searches (prefix) the @defaultQueryAttr attributes", async () => {
      const found = await products.find("Blend");
      expect(found.map((p) => p.sku)).toEqual(
        expect.arrayContaining([`${prefix}-A`, `${prefix}-B`])
      );
    });

    it("paginateBy pages through the results", async () => {
      const page = await products.paginateBy("sku", "asc" as any, { offset: 1, limit: 2 } as any);
      expect(page.data.length).toBeLessThanOrEqual(2);
      expect(page.data.every((p: Product) => p instanceof Product)).toBe(true);
      expect(page.count).toBeGreaterThanOrEqual(3);
    });

    it("aggregations enabled by @controllerConfig", async () => {
      expect(await products.countOf("sku")).toBeGreaterThanOrEqual(3);
      expect(await products.maxOf("price")).toBeGreaterThanOrEqual(120);
      expect(await products.minOf("price")).toBeLessThanOrEqual(6);
      expect(Number(await products.sumOf("stock"))).toBeGreaterThanOrEqual(16);
      expect(await products.distinctOf("category")).toEqual(
        expect.arrayContaining(["coffee", "equipment"])
      );
    });
  });

  describe("error contract (server error -> same decaf error on the client)", () => {
    const sku = uid("ERR").toUpperCase();

    beforeAll(async () => {
      await products.create(product(sku));
    });

    it("rejects a value of the wrong type with 422 ValidationError", async () => {
      const error = await rejection(() =>
        products.create(product(uid("TYPE").toUpperCase(), { price: "cheap" as any }))
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect(statusOf(error)).toBe(422);
      expect(error.message).toContain("price");
      expect(error.message).toContain("Invalid type");
    });

    it("answers 404 NotFoundError when updating a product that does not exist", async () => {
      const error = await rejection(() => products.update(product(uid("GHOST").toUpperCase())));
      expect(error).toBeInstanceOf(NotFoundError);
      expect(statusOf(error)).toBe(404);
    });

    it("rejects an update whose URL pk does not match the payload @pk with 400", async () => {
      // the HttpAdapter always derives the URL from the payload, so send the request by hand
      const token = await backend.keycloak.token(Users.catalogManager);
      const res = await fetch(`http://${backend.host}/product/${sku}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...product("OTHER-SKU"), price: 99 }),
      });
      const body = (await res.json()) as { error: string };
      expect(res.status).toBe(400);
      expect(body.error).toContain(`sku in the URL (${sku}) does not match the payload (OTHER-SKU)`);

      // what a decaf client rebuilds from that response
      const error = parseHttpError(res.status, body);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.code).toBe(400);

      expect((await products.read(sku)).price).toBe(10);
    });

    it("fills a pk missing from the payload from the URL", async () => {
      const token = await backend.keycloak.token(Users.catalogManager);
      const current = await products.read(sku);
      const withoutPk: Record<string, unknown> = { ...current, stock: 7 };
      delete withoutPk.sku;
      const res = await fetch(`http://${backend.host}/product/${sku}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(withoutPk),
      });
      expect(res.status).toBe(200);
      expect((await products.read(sku)).stock).toBe(7);
    });
  });

  describe("authorization", () => {
    it("rejects requests without a token (401)", async () => {
      const error = await rejection(() => anonymous.listBy("sku", "asc" as any));
      expect(statusOf(error)).toBe(401);
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    it("rejects users without the catalog-manager role, on reads and writes", async () => {
      for (const call of [
        () => asCustomer.read("ANY"),
        () => asCustomer.listBy("sku", "asc" as any),
        () => asCustomer.create(product(uid("NOPE").toUpperCase())),
        () => asCustomer.delete("ANY"),
      ]) {
        const error = await rejection(call);
        expect(statusOf(error)).toBe(403);
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });

    it("accepts the role granted as a client role too", async () => {
      const token = await backend.keycloak.token({
        email: "client.role@decaf.test",
        clientRoles: ["catalog-manager"],
      });
      const repo = repositoryFor(httpAdapter(backend.host, { token }), Product);
      await expect(repo.listBy("sku", "asc" as any)).resolves.toBeInstanceOf(Array);
    });
  });
});
