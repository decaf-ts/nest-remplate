/**
 * @module nest-template/controllers/article
 * @description Hand-built model controller with per-route permissions.
 */
import { Type } from "@nestjs/common";
import { FromModelController, Public, RequireRoles } from "@decaf-ts/for-nest";
import { Article } from "../models/Article";
import { Roles } from "../auth/roles";

/**
 * @description Route method names that write records.
 * @const WRITE_ROUTES
 */
const WRITE_ROUTES = ["create", "createAll", "update", "updateAll"];

/**
 * @description Route method names that delete records.
 * @const DELETE_ROUTES
 */
const DELETE_ROUTES = ["delete", "deleteAll"];

/**
 * @description Route method names readable without a token.
 * @const PUBLIC_ROUTES
 */
const PUBLIC_ROUTES = ["read"];

/**
 * @description Applies a method decorator to a route of a generated controller.
 */
function decorate(controller: Type<any>, method: string, decorator: MethodDecorator) {
  const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, method);
  if (descriptor && typeof descriptor.value === "function")
    decorator(controller.prototype, method, descriptor);
}

/**
 * @description Builds the {@link Article} controller with per-operation permissions.
 * @summary `DecafModule` generates one controller per model, protected as a whole (model roles,
 * or `controllerConfig.auth`). When different operations need different permissions, generate
 * the controller yourself with {@link FromModelController.create} and decorate each route with
 * the for-nest auth decorators — the `AuthInterceptor` resolves handler metadata before class
 * metadata, so route decorators win:
 *
 * | Route                                  | Decorator                  |
 * |----------------------------------------|----------------------------|
 * | `GET /article/:slug` (`read`)          | `@Public()`                |
 * | `POST`/`PUT` (`create`, `update`, bulk)| `@RequireRoles("editor")`  |
 * | `DELETE` (`delete`, bulk)              | `@RequireRoles("admin")`   |
 * | everything else (lists, queries, ...)  | `@RequireRoles("reader")`  |
 *
 * The model is hidden from `DecafModule` (`controllerExposure: { Article: false }`) so it is
 * not exposed twice. Must be called AFTER `DecafModule.forRootAsync` booted the persistence layer.
 * @return {Type} The decorated controller class.
 * @function buildArticleController
 */
export function buildArticleController(): Type<any> {
  const controller = FromModelController.create(Article) as unknown as Type<any>;
  const routes = Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== "constructor" &&
      typeof Object.getOwnPropertyDescriptor(controller.prototype, name)?.value ===
        "function"
  );
  for (const route of routes) {
    if (PUBLIC_ROUTES.includes(route)) decorate(controller, route, Public());
    else if (WRITE_ROUTES.includes(route))
      decorate(controller, route, RequireRoles(Roles.EDITOR));
    else if (DELETE_ROUTES.includes(route))
      decorate(controller, route, RequireRoles(Roles.ADMIN));
    else decorate(controller, route, RequireRoles(Roles.READER));
  }
  return controller;
}
