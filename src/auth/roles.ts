/**
 * @module nest-template/auth/roles
 * @description Keycloak roles and namespaces understood by the demo API.
 * @summary Roles are read from the access token's `realm_access.roles` and
 * `resource_access.<client>.roles` claims. Namespaces are read from the `namespaces`
 * (or `namespace`) claim and from roles prefixed with `namespace:` (see
 * `KeycloakNamespaceAuthHandler` in `@decaf-ts/integrations/nest`).
 *
 * | Role / namespace     | Grants                                                                  |
 * |----------------------|-------------------------------------------------------------------------|
 * | `catalog-manager`    | full CRUD on `Product` (model-level `@roles`)                           |
 * | `customer`           | create/read/update `Order` (route-level `controllerConfig.auth.roles`)  |
 * | `agent` + `support`  | full CRUD on `Ticket` (`@roles` + `@namespace` on the model)            |
 * | `reader`             | list/query `Article` (per-route `@RequireRoles`)                        |
 * | `editor`             | create/update `Article`                                                 |
 * | `admin`              | delete `Article`                                                        |
 * | `manager` + `sales`  | `GET /reports/sales` (`@RequireRoles` + `@RequireNamespaces`)           |
 */

/**
 * @description Role names used across the API.
 * @const Roles
 */
export const Roles = {
  CATALOG_MANAGER: "catalog-manager",
  CUSTOMER: "customer",
  AGENT: "agent",
  READER: "reader",
  EDITOR: "editor",
  ADMIN: "admin",
  MANAGER: "manager",
} as const;

/**
 * @description Namespace (tenant/department scope) names used across the API.
 * @const Namespaces
 */
export const Namespaces = {
  SUPPORT: "support",
  SALES: "sales",
} as const;
