/**
 * @module nest-template/auth
 * @description Keycloak-based authentication and authorization wiring.
 */
import { DynamicModule, Global, Module } from "@nestjs/common";
import { Service } from "@decaf-ts/core";
import { DecafAuthModule } from "@decaf-ts/for-nest";
import { AppAuthHandler } from "./auth.handler";
import "./jwt.service";

export * from "./roles";
export * from "./jwt.service";
export * from "./auth.handler";

/**
 * @description Nest injection token of the jwt service.
 * @summary for-nest maps decaf's `@service("jwt")` property injection (used by the Keycloak
 * handler) onto Nest's `@Inject("jwt")`, so the token must be provided to Nest.
 * @const JWT_SERVICE
 */
export const JWT_SERVICE = "jwt";

/**
 * @description Global module exposing decaf's `jwt` service singleton to Nest.
 * @summary The factory returns the very instance `Service.boot()` configures during the
 * `DecafModule` initialization, so Nest and decaf share one verifier.
 * @class JwtModule
 */
@Global()
@Module({
  providers: [{ provide: JWT_SERVICE, useFactory: () => Service.get(JWT_SERVICE) }],
  exports: [JWT_SERVICE],
})
export class JwtModule {}

/**
 * @description Authentication module: jwt service + Keycloak auth handler.
 * @summary `DecafAuthModule` registers the {@link AppAuthHandler} as `AUTH_HANDLER` and provides
 * the `AuthInterceptor`, run by every generated model controller and by any route decorated
 * with `@Auth()`, `@RequireRoles()` or `@RequireNamespaces()`.
 * @class AuthModule
 */
@Module({})
export class AuthModule {
  /**
   * @param {boolean} [logAccess=false] - emit OCSF-style access logs (class_uid 3001/3002).
   * @return {DynamicModule} The configured auth module.
   */
  static forRoot(logAccess = false): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        JwtModule,
        DecafAuthModule.forRoot({
          global: true,
          handler: AppAuthHandler as any,
          logAccess,
        }),
      ],
    };
  }
}
