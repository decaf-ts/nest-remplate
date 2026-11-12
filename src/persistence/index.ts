/**
 * @module nest-template/persistence
 * @description Persistence bootstrap for the template.
 * @summary The template persists to decaf's in-memory {@link RamAdapter} so it runs with zero
 * infrastructure. This module MUST be imported before any model so the adapter decorations
 * (`@createdBy`/`@updatedBy` handlers for the `ram` flavour) are registered and the ram
 * flavour becomes the default one.
 *
 * To move to a real database replace the adapter here and in {@link persistenceConfig}
 * (e.g. `TypeORMAdapter` from `@decaf-ts/for-typeorm` or `NanoAdapter` from
 * `@decaf-ts/for-nano`, with its request-to-context transformer) and update
 * `PersistenceFlavour` in `./flavour.ts` (used by the models' `@uses(...)`).
 */
import { Adapter } from "@decaf-ts/core";
import { RamAdapter, RamFlavour } from "@decaf-ts/core/ram";
import { RamTransformer } from "@decaf-ts/for-http/server";
import { PersistenceFlavour } from "./flavour";

RamAdapter.decoration();
Adapter.setCurrent(RamFlavour);

if (RamFlavour !== PersistenceFlavour)
  throw new Error(`PersistenceFlavour (${PersistenceFlavour}) must match the adapter flavour (${RamFlavour})`);

export * from "./flavour";

/**
 * @description Builds the `conf` entry handed to `DecafModule.forRootAsync`.
 * @summary `[AdapterClass, adapterConfig, requestToContextTransformer]`. The {@link RamTransformer}
 * maps the authenticated `user` (bound by the Keycloak auth handler) onto the `UUID` flag the
 * RAM adapter reads to fill `@createdBy`/`@updatedBy` fields.
 * @return {Array} The DecafModule adapter configuration.
 */
export function persistenceConfig(): any[] {
  return [[RamAdapter, { UUID: "system" }, new RamTransformer()]];
}

export { RamAdapter, RamFlavour };
