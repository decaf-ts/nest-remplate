/**
 * @module nest-template/models/Ticket
 * @description Support ticket, scoped to the support namespace.
 */
import {
  BaseModel,
  column,
  createdBy,
  pk,
  roles,
  table,
  updatedBy,
} from "@decaf-ts/core";
import { readonly } from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import {
  maxlength,
  minlength,
  model,
  option,
  required,
  type ModelArg,
} from "@decaf-ts/decorator-validation";
import { namespace } from "@decaf-ts/integrations/nest";
import { Namespaces, Roles } from "../auth/roles";
import { PersistenceFlavour } from "../persistence/flavour";

/**
 * @description Ticket priorities.
 * @const TicketPriority
 */
export const TicketPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

/**
 * @description A support ticket.
 * @summary Demonstrates combining model-level roles with model-level namespaces:
 * - `@roles(["agent"])` — the token must carry the `agent` role;
 * - `@namespace(["support"])` (from `@decaf-ts/integrations/nest`) — the token must ALSO be scoped
 *   to the `support` namespace (a `namespaces: ["support"]` claim or a `namespace:support` role).
 * @class Ticket
 */
@uses(PersistenceFlavour)
@table("ticket")
@roles([Roles.AGENT])
@namespace([Namespaces.SUPPORT])
@model()
export class Ticket extends BaseModel {
  @pk({ type: String, generated: false })
  id!: string;

  @column()
  @required()
  @minlength(3)
  @maxlength(120)
  subject!: string;

  @column()
  @maxlength(2000)
  description?: string;

  @column()
  @required()
  @option(Object.values(TicketPriority))
  priority!: string;

  @column()
  @createdBy()
  @readonly()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<Ticket>) {
    super(arg);
  }
}
