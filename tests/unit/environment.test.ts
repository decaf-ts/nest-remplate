import { AppEnvironment, keycloakJwksUrl, resolveJwksUrl } from "../../src/config/environment";
import { jwtOptionsFromEnvironment } from "../../src/auth/jwt.service";

/**
 * `AppEnvironment` is a decaf `Environment`: every property is read from `process.env` when
 * accessed (`camelCase` path → `UPPER_SNAKE`, nested with `__`), falling back to the defaults.
 */
describe("AppEnvironment", () => {
  const saved = { ...process.env };
  const ENV_KEYS = [
    "PORT",
    "HOST",
    "CORS_ORIGINS",
    "SWAGGER",
    "SEED",
    "LOG_ACCESS",
    "KEYCLOAK__URL",
    "KEYCLOAK__REALM",
    "KEYCLOAK__CLIENT_ID",
    "JWT__VERIFY_URL",
    "JWT__SECRET",
    "JWT__CLOCK_TOLERANCE_SECONDS",
    "JWT__ALLOW_DECODE_ONLY",
    "EVENTS__ENABLED",
    "EVENTS__PATH",
    "EVENTS__SUBSCRIPTION_MODE",
    "EVENTS__AUTHENTICATE",
  ];

  beforeEach(() => {
    process.env = { ...saved };
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("has sensible defaults", () => {
    expect(AppEnvironment.port).toBe(3000);
    expect(AppEnvironment.host).toBe("0.0.0.0");
    expect(AppEnvironment.corsOrigins).toBe("*");
    expect(AppEnvironment.swagger).toBe(true);
    expect(AppEnvironment.seed).toBe(true);
    expect(AppEnvironment.logAccess).toBe(false);
    expect(AppEnvironment.keycloak.url).toBeUndefined();
    expect(AppEnvironment.keycloak.realm).toBe("decaf");
    expect(AppEnvironment.keycloak.clientId).toBe("decaf-backend");
    expect(AppEnvironment.jwt.verifyUrl).toBeUndefined();
    expect(AppEnvironment.jwt.secret).toBeUndefined();
    expect(AppEnvironment.jwt.clockToleranceSeconds).toBe(5);
    expect(AppEnvironment.jwt.allowDecodeOnly).toBe(false);
    expect(AppEnvironment.events.enabled).toBe(true);
    expect(AppEnvironment.events.path).toBe("/events");
    expect(AppEnvironment.events.subscriptionMode).toBe(false);
    expect(AppEnvironment.events.authenticate).toBe(true);
  });

  it("reads overrides from process.env at access time (booleans, numbers, nested keys)", () => {
    Object.assign(process.env, {
      PORT: "8080",
      CORS_ORIGINS: "http://a.test,http://b.test",
      SWAGGER: "false",
      LOG_ACCESS: "true",
      KEYCLOAK__CLIENT_ID: "my-backend",
      JWT__CLOCK_TOLERANCE_SECONDS: "30",
      EVENTS__SUBSCRIPTION_MODE: "true",
      EVENTS__PATH: "/live",
    });
    expect(AppEnvironment.port).toBe(8080);
    expect(AppEnvironment.corsOrigins).toBe("http://a.test,http://b.test");
    expect(AppEnvironment.swagger).toBe(false);
    expect(AppEnvironment.logAccess).toBe(true);
    expect(AppEnvironment.keycloak.clientId).toBe("my-backend");
    expect(AppEnvironment.jwt.clockToleranceSeconds).toBe(30);
    expect(AppEnvironment.events.subscriptionMode).toBe(true);
    expect(AppEnvironment.events.path).toBe("/live");
  });

  it("derives the Keycloak realm JWKS endpoint", () => {
    expect(keycloakJwksUrl("https://sso.example.com/", "my realm")).toBe(
      "https://sso.example.com/realms/my%20realm/protocol/openid-connect/certs"
    );
    expect(resolveJwksUrl()).toBeUndefined();
    Object.assign(process.env, { KEYCLOAK__URL: "http://kc:8080", KEYCLOAK__REALM: "acme" });
    expect(resolveJwksUrl()).toBe("http://kc:8080/realms/acme/protocol/openid-connect/certs");
  });

  it("an explicit JWT__VERIFY_URL wins over the Keycloak-derived one", () => {
    Object.assign(process.env, {
      KEYCLOAK__URL: "http://kc:8080",
      JWT__VERIFY_URL: "http://jwks/certs",
    });
    expect(resolveJwksUrl()).toBe("http://jwks/certs");
  });

  it("jwt options: JWKS takes precedence over the shared secret", () => {
    Object.assign(process.env, { KEYCLOAK__URL: "http://kc", JWT__SECRET: "s3cret" });
    expect(jwtOptionsFromEnvironment()).toMatchObject({
      verifyUrl: "http://kc/realms/decaf/protocol/openid-connect/certs",
      secret: undefined,
    });
    Object.assign(process.env, { KEYCLOAK__URL: "", JWT__VERIFY_URL: "" });
    expect(jwtOptionsFromEnvironment()).toMatchObject({ verifyUrl: undefined, secret: "s3cret" });
  });
});
