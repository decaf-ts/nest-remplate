/**
 * @module nest-template/auth/handler
 * @description Keycloak auth handler used by every protected route.
 */
import { Injectable } from "@nestjs/common";
import {
  KeycloakNamespaceAuthHandler,
  type AuthRequestLike,
} from "@decaf-ts/integrations/nest";

/**
 * @description Request paths that never require a token.
 * @summary `/public/**` is already public in the base Keycloak handler. The OpenAPI docs
 * are added here so the swagger UI keeps working when the auth interceptor is global.
 * @const PUBLIC_PATHS
 */
export const PUBLIC_PATHS: RegExp[] = [/^\/public(\/|$)/, /^\/docs(-json)?(\/|$)/];

/**
 * @description Keycloak auth handler for the application.
 * @summary Extends {@link KeycloakNamespaceAuthHandler} from `@decaf-ts/integrations/nest`, which:
 * - reads the bearer token from `Authorization` (or `x-auth-request-access-token`, set by oauth2-proxy);
 * - verifies it through the `jwt` service ({@link AppJwtService}: Keycloak JWKS in production);
 * - extracts the user (`email` → `preferred_username`), organization (`aud` → `azp` → realm), realm
 *   and client roles, and namespaces (`namespaces` claim or `namespace:<name>` roles);
 * - binds them to the request context so `@createdBy`/`@updatedBy` and the logger see the user;
 * - checks route roles/namespaces (`@RequireRoles`, `@RequireNamespaces`, `controllerConfig.auth`)
 *   and model roles/namespaces (`@roles`, `@namespace`).
 *
 * This subclass is the place to customize that behaviour for your application (extra public paths,
 * tenant mapping, additional context bindings, ...).
 * @class AppAuthHandler
 */
@Injectable()
export class AppAuthHandler extends KeycloakNamespaceAuthHandler {
  constructor() {
    super();
  }

  protected override isPublicRequest(request: AuthRequestLike): boolean {
    const path = (request.path ?? "").split("?")[0];
    return PUBLIC_PATHS.some((matcher) => matcher.test(path));
  }
}
