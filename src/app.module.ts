/**
 * @module nest-template/app
 * @description Root application module.
 */
import "./persistence/index"; // MUST come before any model
import { DynamicModule, Module } from "@nestjs/common";
import { Service } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { DecafModule, type DecafModuleOptions } from "@decaf-ts/for-nest";
import { AuthModule, Roles } from "./auth/index";
import { AppJwtService } from "./auth/jwt.service";
import {
  AccountController,
  buildArticleController,
  PublicController,
  ReportsController,
} from "./controllers/index";
import { AppEnvironment } from "./config/environment";
import { persistenceConfig, PersistenceFlavour } from "./persistence/index";
import { seed } from "./seed";
import "./models/index";

// keeps the jwt service registered even if a bundler tree-shakes the auth barrel
void AppJwtService;

/**
 * @description Builds the {@link DecafModule} options for the application.
 * @summary
 * - `conf`: the persistence adapter(s) (RAM by default, see `persistence/`);
 * - `autoControllers`: one REST controller (+ OpenAPI) per model;
 * - `controllerExposure`: hides `Article` (exposed by its hand-built controller instead);
 * - `controllerConfig`: per-model controller options set at module level (here: `Order`
 *   route-level roles) — the alternative to the `@controllerConfig()` model decorator;
 * - `observerOptions`: the live events (SSE) API on `EVENTS__PATH` (default `/events`),
 *   authenticated with the same Keycloak handler, optionally in subscription mode;
 * - `initialization`: boots every decaf `@service` (incl. the `jwt` service) and seeds data.
 * Settings are read from {@link AppEnvironment}.
 * @return {DecafModuleOptions} The options.
 */
export function decafOptions(): DecafModuleOptions {
  const events = AppEnvironment.events;
  return {
    conf: persistenceConfig() as DecafModuleOptions["conf"],
    autoControllers: true,
    autoServices: true,
    controllerExposure: { Article: false },
    controllerConfig: {
      Order: { auth: { roles: [Roles.CUSTOMER] } },
    },
    observerOptions: {
      enableObserverEvents: events.enabled,
      observerFlavours: [PersistenceFlavour],
      observerApiPath: events.path,
      subscriptionMode: events.subscriptionMode,
      authenticate: events.authenticate,
    },
    initialization: async () => {
      try {
        await Service.boot();
        if (AppEnvironment.seed) await seed();
      } catch (e: unknown) {
        throw new InternalError(e as Error);
      }
    },
  };
}

/**
 * @description Root module of the application.
 * @summary Use {@link AppModule.forRoot} — the decaf persistence layer is booted asynchronously,
 * and the hand-built controllers can only be generated once it is up.
 * @class AppModule
 */
@Module({})
export class AppModule {
  /**
   * @description Builds the application module.
   * @return {Promise<DynamicModule>} The root module.
   */
  static async forRoot(): Promise<DynamicModule> {
    const decaf = await DecafModule.forRootAsync(decafOptions());
    return {
      module: AppModule,
      imports: [AuthModule.forRoot(AppEnvironment.logAccess), decaf],
      controllers: [
        PublicController,
        AccountController,
        ReportsController,
        buildArticleController(),
      ],
    };
  }
}
