/**
 * @module nest-template/models/Order
 * @description Customer order.
 */
import {
  BaseModel,
  column,
  createdBy,
  pk,
  table,
  updatedBy,
} from "@decaf-ts/core";
import {
  BlockOperations,
  BulkCrudOperationKeys,
  OperationKeys,
  readonly,
} from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import {
  max,
  maxlength,
  min,
  model,
  option,
  required,
  type ModelArg,
} from "@decaf-ts/decorator-validation";
import { PersistenceFlavour } from "../persistence/flavour";

/**
 * @description Accepted order states.
 * @const OrderStatus
 */
export const OrderStatus = {
  PLACED: "placed",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
} as const;

/**
 * @description An order placed by a customer.
 * @summary Demonstrates:
 * - route-level roles configured at the MODULE level (`controllerConfig: { Order: { auth: { roles: ["customer"] } } }`
 *   in {@link AppModule}), which keeps the model free of server-side decorators;
 * - `@BlockOperations([DELETE, bulk DELETE_ALL])` — orders are cancelled, never deleted (no DELETE routes);
 * - `@createdBy()` — the customer is always the authenticated user, whatever the payload says.
 * @class Order
 */
@uses(PersistenceFlavour)
@table("customer_order")
@BlockOperations([
  OperationKeys.DELETE,
  { kind: "bulk", value: BulkCrudOperationKeys.DELETE_ALL },
])
@model()
export class Order extends BaseModel {
  @pk({ type: String, generated: false })
  id!: string;

  /** sku of the ordered {@link Product} */
  @column()
  @required()
  productSku!: string;

  @column()
  @required()
  @min(1)
  @max(100)
  quantity!: number;

  @column()
  @required()
  @option(Object.values(OrderStatus))
  status!: string;

  @column()
  @maxlength(500)
  notes?: string;

  /** the authenticated user that placed the order */
  @column()
  @createdBy()
  @readonly()
  customer!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<Order>) {
    super(arg);
  }
}
