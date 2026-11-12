/**
 * @module nest-template/models/Category
 * @description Public, read-only product category.
 */
import { BaseModel, column, pk, table } from "@decaf-ts/core";
import {
  BlockOperations,
  BulkCrudOperationKeys,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import {
  maxlength,
  minlength,
  model,
  pattern,
  required,
  type ModelArg,
} from "@decaf-ts/decorator-validation";
import { controllerConfig } from "@decaf-ts/for-nest";
import { PersistenceFlavour } from "../persistence/flavour";

/**
 * @description A product category, readable by anyone.
 * @summary Demonstrates:
 * - `@controllerConfig({ auth: { public: true } })` — every generated route is public (no token);
 * - `@BlockOperations([...])` — the single AND bulk write routes are not generated at all (single
 *   and bulk operations are blocked independently). Categories are seeded server-side through the repository, which is unaffected.
 * @class Category
 */
@uses(PersistenceFlavour)
@table("category")
@controllerConfig({ auth: { public: true } })
@BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
  { kind: "bulk", value: BulkCrudOperationKeys.CREATE_ALL },
  { kind: "bulk", value: BulkCrudOperationKeys.UPDATE_ALL },
  { kind: "bulk", value: BulkCrudOperationKeys.DELETE_ALL },
])
@model()
export class Category extends BaseModel {
  /** url-friendly identifier, e.g. `coffee` */
  @pk({ type: String, generated: false })
  @pattern(/^[a-z0-9-]{2,40}$/)
  id!: string;

  @column()
  @required()
  @minlength(2)
  @maxlength(60)
  name!: string;

  @column()
  @maxlength(280)
  description?: string;

  constructor(arg?: ModelArg<Category>) {
    super(arg);
  }
}
