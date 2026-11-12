/**
 * Article: hand-built model controller with per-route `@Public()` / `@RequireRoles()`.
 *
 * | route                         | requirement |
 * |-------------------------------|-------------|
 * | read (GET /article/:slug)     | public      |
 * | lists / queries               | reader      |
 * | create / update (single/bulk) | editor      |
 * | delete (single/bulk)          | admin       |
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, rejection, repositoryFor, statusOf, uid } from "./harness/client";
import { Users, type Persona } from "./harness/users";
import { Article } from "../../src/index";

describe("Article API — per-route permissions", () => {
  let backend: Backend;
  const repos: Partial<Record<Persona | "anonymous", ReturnType<typeof repositoryFor<Article>>>> = {};
  const as = (who: Persona | "anonymous") => repos[who]!;

  const article = (slug: string, extra: Partial<Article> = {}) =>
    new Article({ slug, title: `About ${slug}`, body: "Lorem ipsum dolor", topic: "brewing", ...extra });

  beforeAll(async () => {
    backend = await bootBackend();
    for (const persona of ["reader", "editor", "admin", "customer"] as Persona[]) {
      repos[persona] = repositoryFor(
        httpAdapter(backend.host, { token: await backend.keycloak.token(Users[persona]) }),
        Article
      );
    }
    repos.anonymous = repositoryFor(httpAdapter(backend.host), Article);
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("editor creates and updates; anyone reads a single article", async () => {
    const slug = uid("pour-over");
    const created = await as("editor").create(article(slug));
    expect(created.createdBy).toBe(Users.editor.email);

    const updated = await as("editor").update(
      new Article({ ...(await as("editor").read(slug)), title: "Pour-over, revisited" })
    );
    expect(updated.title).toBe("Pour-over, revisited");

    const publicRead = await as("anonymous").read(slug);
    expect(publicRead.title).toBe("Pour-over, revisited");
    expect((await as("customer").read(slug)).slug).toBe(slug);
  });

  it("lists and queries require the reader role", async () => {
    const slug = uid("cold-brew");
    await as("editor").create(article(slug, { title: "Cold brew at home", topic: "cold" }));

    const byTopic = await as("reader").findBy("topic", "cold");
    expect(byTopic.map((a) => a.slug)).toContain(slug);
    expect((await as("reader").find("Cold brew")).map((a) => a.slug)).toContain(slug);
    expect(await as("reader").countOf("slug")).toBeGreaterThanOrEqual(1);

    for (const [who, status] of [["anonymous", 401], ["customer", 403]] as const) {
      const error = await rejection(() => as(who).findBy("topic", "cold"));
      expect(statusOf(error)).toBe(status);
    }
  });

  it("writes require the editor role", async () => {
    for (const [who, status] of [["reader", 403], ["customer", 403], ["anonymous", 401]] as const) {
      const error = await rejection(() => as(who).create(article(uid("nope"))));
      expect(statusOf(error)).toBe(status);
    }
    const bulkError = await rejection(() => as("reader").createAll([article(uid("nope"))]));
    expect(statusOf(bulkError)).toBe(403);
  });

  it("deletes require the admin role", async () => {
    const slug = uid("to-delete");
    await as("editor").create(article(slug));

    const editorError = await rejection(() => as("editor").delete(slug));
    expect(statusOf(editorError)).toBe(403);

    const deleted = await as("admin").delete(slug);
    expect(deleted.slug).toBe(slug);
    expect(statusOf(await rejection(() => as("anonymous").read(slug)))).toBe(404);
  });
});
