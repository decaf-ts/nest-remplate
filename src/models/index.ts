/**
 * @module nest-template/models
 * @description Demo domain models exposed by the API.
 * @summary Each model showcases a different way of protecting the auto-generated REST API:
 *
 * | Model      | Protection                                                                 |
 * |------------|----------------------------------------------------------------------------|
 * | `Category` | public (`controllerConfig.auth.public`) and read-only (`@BlockOperations`) |
 * | `Product`  | model roles (`@roles`) + aggregation/bulk routes (`@controllerConfig`)     |
 * | `Order`    | route roles from the module-level `controllerConfig` + no DELETE           |
 * | `Ticket`   | model roles (`@roles`) AND model namespaces (`@namespace`)                 |
 * | `Article`  | per-route `@Public` / `@RequireRoles` on a hand-built controller           |
 */
export * from "./Category";
export * from "./Product";
export * from "./Order";
export * from "./Ticket";
export * from "./Article";
