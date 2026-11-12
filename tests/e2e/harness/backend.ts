/**
 * Boots the real application (same `createApp` used by `main.ts`) on an ephemeral port.
 */
import type { INestApplication } from "@nestjs/common";
import { KeycloakStub } from "./keycloak";

export interface Backend {
  app: INestApplication;
  host: string;
  baseUrl: string;
  keycloak: KeycloakStub;
  close: () => Promise<void>;
}

/**
 * @param env - extra environment variables (e.g. `EVENTS__SUBSCRIPTION_MODE`)
 */
export async function bootBackend(env: Record<string, string> = {}): Promise<Backend> {
  const keycloak = await new KeycloakStub().start();
  Object.assign(process.env, {
    KEYCLOAK__URL: keycloak.url,
    KEYCLOAK__REALM: keycloak.realm,
    KEYCLOAK__CLIENT_ID: keycloak.clientId,
    SWAGGER: "true",
    SEED: "true",
    ...env,
  });
  // imported lazily so the environment above is in place before the app modules load
  const { createApp } = await import("../../../src/bootstrap");
  const app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string") throw new Error("Failed to resolve backend address");
  const host = `127.0.0.1:${address.port}`;
  return {
    app,
    host,
    baseUrl: `http://${host}`,
    keycloak,
    close: async () => {
      // open SSE streams and keep-alive sockets would otherwise hold server.close()
      const server = app.getHttpServer();
      const reaper = setInterval(() => server.closeAllConnections?.(), 50);
      try {
        await app.close();
      } finally {
        clearInterval(reaper);
        await keycloak.stop();
      }
    },
  };
}
