/**
 * @module nest-template/persistence/flavour
 * @description Side-effect free persistence flavour constant.
 * @summary Models reference the flavour through this module (instead of `persistence/index`)
 * so that importing the models — e.g. from a frontend using `@decaf-ts/for-http` — does not
 * register the RAM adapter's server-side decorations.
 */

/**
 * @description The adapter flavour every demo model persists to (`RamFlavour`).
 * @const PersistenceFlavour
 */
export const PersistenceFlavour = "ram";
