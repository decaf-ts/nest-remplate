/**
 * Personas used across the e2e suites (see src/auth/roles.ts for what each grants).
 */
import { Namespaces, Roles } from "../../../src/auth/roles";
import type { TokenUser } from "./keycloak";

export const Users = {
  catalogManager: { email: "carla.catalog@decaf.test", roles: [Roles.CATALOG_MANAGER] },
  /** customer role granted as a CLIENT role (resource_access) rather than a realm role */
  customer: { email: "chris.customer@decaf.test", clientRoles: [Roles.CUSTOMER] },
  otherCustomer: { email: "olga.other@decaf.test", roles: [Roles.CUSTOMER] },
  supportAgent: {
    email: "sam.support@decaf.test",
    roles: [Roles.AGENT],
    namespaces: [Namespaces.SUPPORT],
  },
  /** has the role but is not scoped to the support namespace */
  agentWithoutNamespace: { email: "nick.nonamespace@decaf.test", roles: [Roles.AGENT] },
  /** is scoped to support but lacks the agent role */
  supportWithoutRole: { email: "rita.norole@decaf.test", namespaces: [Namespaces.SUPPORT] },
  reader: { email: "rory.reader@decaf.test", roles: [Roles.READER] },
  editor: { email: "eddie.editor@decaf.test", roles: [Roles.READER, Roles.EDITOR] },
  admin: { email: "ada.admin@decaf.test", roles: [Roles.READER, Roles.EDITOR, Roles.ADMIN] },
  /** namespace granted through a `namespace:<name>` ROLE instead of the namespaces claim */
  salesManager: { email: "mia.manager@decaf.test", roles: [Roles.MANAGER, `namespace:${Namespaces.SALES}`] },
  managerWithoutNamespace: { email: "max.manager@decaf.test", roles: [Roles.MANAGER] },
  nobody: { email: "nobody@decaf.test", roles: [] },
} satisfies Record<string, TokenUser>;

export type Persona = keyof typeof Users;
