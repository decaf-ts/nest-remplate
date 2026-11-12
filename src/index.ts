/**
 * @module nest-template
 * @description Template for decaf-ts NestJS backends.
 * @summary Barrel of the application's building blocks (used by the e2e tests; the deliverable
 * of this repository is the Docker image, not an npm package):
 * - {@link AppModule} / {@link createApp}: the application and its factory;
 * - the demo models;
 * - the Keycloak auth handler, jwt service, roles and namespaces;
 * - the {@link AppEnvironment}.
 */
import "./persistence/index";

export * from "./persistence/index";
export * from "./config/environment";
export * from "./auth/index";
export * from "./models/index";
export * from "./controllers/index";
export * from "./seed";
export * from "./app.module";
export * from "./bootstrap";
export * from "./version";
