/**
 * Authentication: Keycloak token verification (JWKS), public routes and `@Auth()`.
 */
import { bootBackend, type Backend } from "./harness/backend";
import { Users } from "./harness/users";

describe("Authentication", () => {
  let backend: Backend;

  async function get(path: string, token?: string) {
    const res = await fetch(`${backend.baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not json
    }
    return { status: res.status, body };
  }

  beforeAll(async () => {
    backend = await bootBackend();
  });

  afterAll(async () => {
    await backend?.close();
  });

  describe("public routes", () => {
    it("GET /public/status needs no token", async () => {
      const { status, body } = await get("/public/status");
      expect(status).toBe(200);
      expect(body).toMatchObject({ name: "@decaf-ts/nest-template", status: "ok" });
    });

    it("serves the OpenAPI document with every model and custom controller", async () => {
      const { status, body } = await get("/docs-json");
      expect(status).toBe(200);
      const paths = Object.keys(body.paths);
      for (const path of ["/category/{id}", "/product", "/customer-order", "/ticket", "/article/{slug}", "/me", "/reports/sales", "/public/status"])
        expect(paths).toContain(path);
      expect(body.components.securitySchemes).toBeDefined();
    });
  });

  describe("GET /me — @Auth() without a model", () => {
    it("returns the principal extracted from the Keycloak token", async () => {
      const token = await backend.keycloak.token(Users.supportAgent);
      const { status, body } = await get("/me", token);
      expect(status).toBe(200);
      expect(body.user).toBe(Users.supportAgent.email);
      expect(body.organization).toBe(backend.keycloak.clientId);
      expect(body.roles).toEqual(expect.arrayContaining(["agent"]));
      expect(body.namespaces).toEqual(["support"]);
    });

    it("accepts any authenticated user, whatever the roles", async () => {
      expect((await get("/me", await backend.keycloak.token(Users.nobody))).status).toBe(200);
    });

    it("accepts the token from the oauth2-proxy header", async () => {
      const token = await backend.keycloak.token(Users.reader);
      const res = await fetch(`${backend.baseUrl}/me`, {
        headers: { "x-auth-request-access-token": token },
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).user).toBe(Users.reader.email);
    });
  });

  describe("token verification", () => {
    it("rejects a missing token", async () => {
      const { status, body } = await get("/me");
      expect(status).toBe(401);
      expect(body.error).toContain("Token not found");
    });

    it("rejects a token signed by a key that is not in the realm JWKS", async () => {
      const forged = await backend.keycloak.token(Users.admin, { forgeSignature: true });
      const { status, body } = await get("/me", forged);
      expect(status).toBe(401);
      expect(body.error).toContain("signature verification failed");
    });

    it("rejects an expired token", async () => {
      const expired = await backend.keycloak.token(Users.admin, { expiresIn: "-1m" });
      const { status, body } = await get("/me", expired);
      expect(status).toBe(401);
      expect(body.error).toContain('"exp"');
    });

    it("rejects garbage", async () => {
      expect((await get("/me", "not-a-jwt")).status).toBe(401);
    });
  });
});
