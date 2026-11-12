/**
 * In-process Keycloak stand-in for the e2e tests.
 *
 * Serves a real RS256 JWKS on Keycloak's own endpoint layout
 * (`/realms/<realm>/protocol/openid-connect/certs`) and issues tokens shaped like
 * Keycloak access tokens (`iss`, `aud`, `azp`, `realm_access`, `resource_access`, ...).
 * The application under test is booted with `KEYCLOAK__URL` pointing here, so it
 * verifies signatures through the exact same JWKS code path used in production.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";

export interface TokenUser {
  /** becomes the `email` claim, i.e. the request `user` (and `createdBy`) */
  email: string;
  /** realm roles (`realm_access.roles`) */
  roles?: string[];
  /** client roles (`resource_access.<clientId>.roles`) */
  clientRoles?: string[];
  /** namespaces (`namespaces` claim) */
  namespaces?: string[];
}

export interface TokenOptions {
  /** token lifetime (jose syntax). Negative values (e.g. "-1m") produce an expired token */
  expiresIn?: string;
  /** sign with a key that is NOT published in the JWKS */
  forgeSignature?: boolean;
}

export class KeycloakStub {
  readonly realm: string;
  readonly clientId: string;
  private server?: Server;
  private keys?: { privateKey: CryptoKey; jwk: JWK };
  private rogue?: CryptoKey;
  url = "";

  constructor(realm = "decaf", clientId = "decaf-backend") {
    this.realm = realm;
    this.clientId = clientId;
  }

  get issuer(): string {
    return `${this.url}/realms/${this.realm}`;
  }

  get jwksPath(): string {
    return `/realms/${this.realm}/protocol/openid-connect/certs`;
  }

  async start(): Promise<this> {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "e2e-key", alg: "RS256", use: "sig" };
    this.keys = { privateKey, jwk };
    this.rogue = (await generateKeyPair("RS256")).privateKey;

    this.server = createServer((req, res) => {
      if (req.url === this.jwksPath) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
    return this;
  }

  async token(user: TokenUser, options: TokenOptions = {}): Promise<string> {
    if (!this.keys || !this.rogue) throw new Error("KeycloakStub not started");
    const payload: Record<string, unknown> = {
      email: user.email,
      email_verified: true,
      preferred_username: user.email.split("@")[0],
      azp: this.clientId,
      realm_access: { roles: user.roles ?? [] },
      resource_access: {
        [this.clientId]: { roles: user.clientRoles ?? [] },
        account: { roles: ["manage-account", "view-profile"] },
      },
    };
    if (user.namespaces) payload.namespaces = user.namespaces;
    const expiresIn = options.expiresIn ?? "5m";
    const now = Math.floor(Date.now() / 1000);
    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "e2e-key" })
      .setIssuer(this.issuer)
      .setAudience(this.clientId)
      .setSubject(user.email)
      .setIssuedAt(expiresIn.startsWith("-") ? now - 600 : now);
    jwt.setExpirationTime(expiresIn.startsWith("-") ? now - 300 : expiresIn);
    return jwt.sign(options.forgeSignature ? this.rogue : this.keys.privateKey);
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }
}
