/**
 * @module nest-template/auth/jwt
 * @description JWT verification service backing the Keycloak auth handler.
 */
import { MaybeContextualArg, service } from "@decaf-ts/core";
import { JwtService } from "@decaf-ts/crypto/integration/services/jwt";
import type { JwtOptions } from "@decaf-ts/crypto/jwt";
import { Logging } from "@decaf-ts/logging";
import { AppEnvironment, resolveJwksUrl } from "../config/environment";

/**
 * @description Builds the JWT options from the application environment.
 * @summary Verification strategy, by precedence:
 * 1. `JWT__VERIFY_URL`, or the JWKS endpoint derived from `KEYCLOAK__URL` + `KEYCLOAK__REALM` (RS256, production);
 * 2. `JWT__SECRET` (HS256 shared secret, local development);
 * 3. `JWT__ALLOW_DECODE_ONLY=true` (signature NOT verified — development only).
 * @return {JwtOptions} The options for `@decaf-ts/crypto`'s {@link JwtService}.
 */
export function jwtOptionsFromEnvironment(): JwtOptions {
  const { jwt } = AppEnvironment;
  const verifyUrl = resolveJwksUrl();
  return {
    verifyUrl,
    secret: verifyUrl ? undefined : jwt.secret || undefined,
    clockToleranceSeconds: jwt.clockToleranceSeconds,
    allowDecodeOnly: jwt.allowDecodeOnly || undefined,
  };
}

/**
 * @description The `jwt` service injected (via `@service("jwt")`) into the Keycloak auth handler.
 * @summary Extends `@decaf-ts/crypto`'s JwtService, configuring it from the environment when
 * `Service.boot()` runs during `DecafModule` initialization.
 * @class AppJwtService
 */
@service("jwt")
export class AppJwtService extends JwtService {
  constructor() {
    super();
  }

  override async initialize(...args: MaybeContextualArg<any>) {
    const explicit = (args[0] ?? {}) as JwtOptions;
    const options = { ...jwtOptionsFromEnvironment(), ...explicit };
    if (!options.verifyUrl && !options.secret && !options.allowDecodeOnly) {
      Logging.for(AppJwtService).warn(
        "No JWT verification configured (KEYCLOAK__URL, JWT__VERIFY_URL or JWT__SECRET). Every authenticated request will be rejected."
      );
    }
    return super.initialize(options, ...args.slice(1));
  }
}
