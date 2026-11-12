/**
 * @module nest-template/bootstrap
 * @description Application factory shared by `main.ts` and the e2e tests.
 */
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestBootstraper } from "@decaf-ts/for-nest";
import { AppModule } from "./app.module";
import { AppEnvironment } from "./config/environment";
import { VERSION } from "./version";

/**
 * @description Options for {@link createApp}.
 * @interface CreateAppOptions
 */
export interface CreateAppOptions {
  /** forwarded to `NestFactory.create` (e.g. `false` to silence Nest's logger) */
  logger?: false | ("log" | "error" | "warn" | "debug" | "verbose" | "fatal")[];
}

/**
 * @description Creates and configures the Nest application (without listening).
 * @summary Applies the decaf {@link NestBootstraper} defaults: helmet, CORS, the decaf
 * exception filter (maps decaf errors to HTTP statuses) and, when enabled, Swagger UI on `/docs`.
 * @param {CreateAppOptions} [options] - Creation options.
 * @return {Promise<INestApplication>} The initialized application.
 * @function createApp
 */
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(await AppModule.forRoot(), {
    logger: options.logger,
  });
  const corsOrigins = String(AppEnvironment.corsOrigins);
  const origins =
    corsOrigins === "*" ? "*" : corsOrigins.split(",").map((o) => o.trim());

  let bootstrap = NestBootstraper.initialize(app)
    .enableCors(origins)
    .useHelmet()
    .useGlobalFilters();
  if (AppEnvironment.swagger)
    bootstrap = bootstrap.setupSwagger({
      title: "Decaf Nest Template API",
      description:
        "Demo API generated from decaf-ts models, protected by Keycloak, with live events (SSE).",
      version: VERSION,
      path: "docs",
      openApiJsonPath: "docs-json",
      persistAuthorization: true,
    });
  void bootstrap;
  await app.init();
  return app;
}
