import "../../src/persistence/index";
import { AppAuthHandler, PUBLIC_PATHS } from "../../src/auth/auth.handler";

describe("AppAuthHandler", () => {
  const handler = new AppAuthHandler();
  const isPublic = (path: string) => (handler as any).isPublicRequest({ path, headers: {} });

  it("treats /public and the OpenAPI docs as public", () => {
    for (const path of ["/public", "/public/status", "/docs", "/docs/", "/docs-json", "/public/status?x=1"])
      expect(isPublic(path)).toBe(true);
  });

  it("protects everything else", () => {
    for (const path of ["/product", "/me", "/events", "/publicity", "/documents", "/reports/sales"])
      expect(isPublic(path)).toBe(false);
  });

  it("exposes the matchers for customization", () => {
    expect(PUBLIC_PATHS.length).toBeGreaterThan(0);
  });
});
