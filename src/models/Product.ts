/**
 * @module nest-template/models/Product
 * @description Catalog product, managed by catalog managers.
 */
import {
  BaseModel,
  column,
  createdBy,
  defaultQueryAttr,
  pk,
  roles,
  table,
  updatedBy,
} from "@decaf-ts/core";
import { readonly } from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import {
  maxlength,
  min,
  minlength,
  model,
  pattern,
  required,
  type ModelArg,
} from "@decaf-ts/decorator-validation";
import { controllerConfig } from "@decaf-ts/for-nest";
import { Roles } from "../auth/roles";
import { PersistenceFlavour } from "../persistence/flavour";

/**
 * @description A product of the catalog.
 * @summary Demonstrates:
 * - `@roles(["catalog-manager"])` — model-level roles, enforced by the auth handler on every
 *   generated route (CRUD, bulk and queries);
 * - `@controllerConfig(...)` — enables the aggregation routes (`count`, `sum`, `avg`, ...)
 *   and the bulk statement routes for this model only;
 * - `@createdBy()` / `@updatedBy()` — filled with the Keycloak user (token `email`) by the
 *   request-to-context transformer. `@createdBy()` only runs on create, so it is paired with
 *   `@readonly()` to reject updates that try to rewrite the author.
 * @class Product
 */
@uses(PersistenceFlavour)
@table("product")
@roles([Roles.CATALOG_MANAGER])
@controllerConfig({
  allowGroupingQueries: {
    count: true,
    sum: true,
    avg: true,
    max: true,
    min: true,
    distinct: true,
    group: true,
  },
  allowBulkStatement: true,
})
@model()
export class Product extends BaseModel {
  /** stock keeping unit, e.g. `ESP-001` */
  @pk({ type: String, generated: false })
  @pattern(/^[A-Z0-9-]{3,32}$/)
  sku!: string;

  /** searched by the free-text `find`/`page` routes (`@defaultQueryAttr`) */
  @column()
  @required()
  @minlength(3)
  @maxlength(120)
  @defaultQueryAttr()
  name!: string;

  /** id of the {@link Category} the product belongs to */
  @column()
  @required()
  category!: string;

  @column()
  @required()
  @min(0)
  price!: number;

  @column()
  @required()
  @min(0)
  stock!: number;

  @column()
  @createdBy()
  @readonly()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<Product>) {
    super(arg);
  }
}
