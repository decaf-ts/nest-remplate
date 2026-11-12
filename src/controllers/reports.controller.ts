/**
 * @module nest-template/controllers/reports
 * @description Business reports built on top of the decaf repositories.
 */
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Repo } from "@decaf-ts/core";
import {
  Repository,
  RequireNamespaces,
  RequireRoles,
} from "@decaf-ts/for-nest";
import { Namespaces, Roles } from "../auth/roles";
import { Order, OrderStatus } from "../models/Order";
import { Product } from "../models/Product";

/**
 * @description One line of the sales report.
 * @interface SalesLine
 */
export interface SalesLine {
  sku: string;
  quantity: number;
  revenue: number;
}

/**
 * @description The sales report.
 * @interface SalesReport
 */
export interface SalesReport {
  orders: number;
  revenue: number;
  lines: SalesLine[];
}

/**
 * @description `GET /reports/sales` — revenue per product over non-cancelled orders.
 * @summary Demonstrates a custom controller protected by `@RequireRoles("manager")` AND
 * `@RequireNamespaces("sales")`, using decaf repositories injected with for-nest's
 * `@Repository(Model)` parameter decorator.
 * @class ReportsController
 */
@ApiTags("Reports")
@RequireRoles(Roles.MANAGER)
@RequireNamespaces(Namespaces.SALES)
@Controller("reports")
export class ReportsController {
  constructor(
    @Repository(Order) private readonly orders: Repo<Order>,
    @Repository(Product) private readonly products: Repo<Product>
  ) {}

  @Get("sales")
  @ApiOperation({ summary: "Revenue per product (requires role 'manager' in namespace 'sales')" })
  @ApiOkResponse({ description: "The sales report" })
  async sales(): Promise<SalesReport> {
    const orders = (await this.orders.select().execute()).filter(
      (order) => order.status !== OrderStatus.CANCELLED
    );
    const prices = new Map<string, number>();
    for (const product of await this.products.select().execute())
      prices.set(product.sku, product.price);

    const lines = new Map<string, SalesLine>();
    for (const order of orders) {
      const line = lines.get(order.productSku) ?? {
        sku: order.productSku,
        quantity: 0,
        revenue: 0,
      };
      line.quantity += order.quantity;
      line.revenue += order.quantity * (prices.get(order.productSku) ?? 0);
      lines.set(order.productSku, line);
    }
    const sorted = [...lines.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    return {
      orders: orders.length,
      revenue: sorted.reduce((total, line) => total + line.revenue, 0),
      lines: sorted,
    };
  }
}
