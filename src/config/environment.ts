/**
 * @module nest-template/config
 * @description Typed, environment-driven configuration for the application.
 * @summary {@link AppEnvironment} is a decaf-ts `Environment` seeded with
 * {@link DefaultEnvironment}: every property is read from `process.env` when it is accessed
 * (`camelCase` → `UPPER_SNAKE`, nested keys joined with `__`, e.g. `CORS_ORIGINS`,
 * `KEYCLOAK__REALM`, `EVENTS__SUBSCRIPTION_MODE`), falling back to the default. `"true"`/`"false"`
 * become booleans and numeric strings become numbers.
 */

import { LoggedEnvironment } from "@decaf-ts/logging";

/**
 * @description Keycloak connection settings.
 * @summary Used to derive the JWKS endpoint (`<url>/realms/<realm>/protocol/openid-connect/certs`)
 * against which access tokens are verified.
 */
export interface KeycloakEnvironment {
  /** Keycloak base url, e.g. `http://localhost:8180` */
  url?: string;
  /** realm issuing the access tokens */
  realm: string;
  /** client id of this backend (informative; roles are read from every client) */
  clientId: string;
}

/**
 * @description JWT verification settings.
 * @summary Resolution order mirrors `@decaf-ts/crypto`'s `verifyJwt`: an explicit JWKS url
 * wins, then the url derived from {@link KeycloakEnvironment}, then a shared HS256 secret.
 * Decode-only mode is an explicit, development-only escape hatch.
 */
export interface JwtEnvironment {
  /** explicit JWKS url (overrides the Keycloak-derived one) */
  verifyUrl?: string;
  /** HS256 shared secret (useful for local development without Keycloak) */
  secret?: string;
  /** accepted clock skew, in seconds */
  clockToleranceSeconds: number;
  /** decode tokens WITHOUT verifying signatures. Never enable in production */
  allowDecodeOnly: boolean;
}

/**
 * @description Live events (SSE) settings.
 */
export interface EventsEnvironment {
  /** enables the `/events` SSE endpoint */
  enabled: boolean;
  /** path of the SSE endpoint */
  path: string;
  /** when true, clients must `POST <path>/subscribe` to the tables they want to receive */
  subscriptionMode: boolean;
  /** runs the Keycloak auth handler on the stream and subscription endpoints */
  authenticate: boolean;
}

/**
 * @description Complete application environment.
 */
export interface AppEnvironment {
  /** http port */
  port: number;
  /** bind host */
  host: string;
  /** comma separated list of allowed CORS origins, or `*` */
  corsOrigins: string;
  /** enables the swagger UI (`/docs`) and OpenAPI json (`/docs-json`) */
  swagger: boolean;
  /** seeds the demo categories on boot */
  seed: boolean;
  /** emits OCSF-style access logs from the auth handler */
  logAccess: boolean;
  keycloak: KeycloakEnvironment;
  jwt: JwtEnvironment;
  events: EventsEnvironment;
}

/**
 * @description Builds the JWKS endpoint of a Keycloak realm.
 * @param {string} url - Keycloak base url.
 * @param {string} realm - The realm name.
 * @return {string} The realm's `certs` endpoint.
 */
export function keycloakJwksUrl(url: string, realm: string): string {
  return `${url.replace(/\/+$/, "")}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/certs`;
}

export const DefaultEnvironment: AppEnvironment = {
  port: 3000,
  host: "0.0.0.0",
  corsOrigins: "*",
  swagger: true,
  seed: true,
  logAccess: false,
  keycloak: {
    url: "",
    realm: "decaf",
    clientId: "decaf-backend",
  },
  jwt: {
    verifyUrl: "",
    secret: "",
    clockToleranceSeconds: 5,
    allowDecodeOnly: false,
  },
  events: {
    enabled: true,
    path: "/events",
    subscriptionMode: false,
    authenticate: true,
  },
};

export const AppEnvironment: AppEnvironment =
  LoggedEnvironment.accumulate(DefaultEnvironment);

/**
 * @description Resolves the JWKS url tokens are verified against, if any.
 * @return {string | undefined} The explicit `JWT__VERIFY_URL`, or the Keycloak realm's certs endpoint.
 */
export function resolveJwksUrl(): string | undefined {
  if (AppEnvironment.jwt.verifyUrl) return AppEnvironment.jwt.verifyUrl;
  if (AppEnvironment.keycloak.url)
    return keycloakJwksUrl(
      AppEnvironment.keycloak.url,
      AppEnvironment.keycloak.realm
    );
  return undefined;
}
