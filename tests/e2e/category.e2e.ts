/**
 * Category: public (`@controllerConfig({ auth: { public: true } })`) and read-only
 * (`@BlockOperations`) — server-seeded reference data.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, rejection, repositoryFor, statusOf } from "./harness/client";
import { Users } from "./harness/users";
import { Category, SEED_CATEGORIES } from "../../src/index";

describe("Category API — public, read-only", () => {
  let backend: Backend;
  let anonymous: ReturnType<typeof repositoryFor<Category>>;

  beforeAll(async () => {
    backend = await bootBackend();
    anonymous = repositoryFor(httpAdapter(backend.host), Category);
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("reads a seeded category without a token", async () => {
    const coffee = await anonymous.read("coffee");
    expect(coffee).toBeInstanceOf(Category);
    expect(coffee.name).toBe("Coffee");
  });

  it("lists, filters and bulk-reads without a token", async () => {
    const all = await anonymous.listBy("name", "asc" as any);
    expect(all.map((c: Category) => c.id)).toEqual(
      [...SEED_CATEGORIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.id)
    );
    const byName = await anonymous.findBy("name", "Equipment");
    expect(byName.map((c) => c.id)).toEqual(["equipment"]);
    const some = await anonymous.readAll(["coffee", "accessories"]);
    expect(some.map((c) => c.id).sort()).toEqual(["accessories", "coffee"]);
    expect(await anonymous.countOf("id")).toBe(SEED_CATEGORIES.length);
  });

  it("returns 404 for unknown categories", async () => {
    const error = await rejection(() => anonymous.read("does-not-exist"));
    expect(statusOf(error)).toBe(404);
  });

  it("does not expose create/update/delete routes, single or bulk — even to authenticated users", async () => {
    const token = await backend.keycloak.token(Users.admin);
    const admin = repositoryFor(httpAdapter(backend.host, { token }), Category);
    const fresh = new Category({ id: "tea", name: "Tea" });
    const calls = [
      () => admin.create(fresh),
      () => admin.createAll([fresh]),
      () => admin.update(new Category({ id: "coffee", name: "Not coffee" })),
      () => admin.updateAll([new Category({ id: "coffee", name: "Not coffee" })]),
      () => admin.delete("coffee"),
      () => admin.deleteAll(["coffee"]),
    ];
    for (const call of calls) {
      const error = await rejection(call);
      // blocked operations have no route: the decaf exception filter answers 406 (NotAcceptableError)
      expect(statusOf(error)).toBe(406);
    }
    expect((await anonymous.read("coffee")).name).toBe("Coffee");
  });
});
