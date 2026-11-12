/**
 * @module nest-template/controllers/account
 * @description Endpoints about the authenticated principal.
 */
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Auth, DecafRequestContext } from "@decaf-ts/for-nest";

/**
 * @description The authenticated principal, as seen by the API.
 * @interface Principal
 */
export interface Principal {
  user?: string;
  organization?: string;
  roles: string[];
  namespaces: string[];
}

/**
 * @description `GET /me` — returns the authenticated principal.
 * @summary Demonstrates `@Auth()` WITHOUT a model: any valid token is accepted (no role
 * requirement), and the data the Keycloak auth handler bound to the request context is read
 * back from the request-scoped {@link DecafRequestContext}.
 * @class AccountController
 */
@ApiTags("Account")
@Auth()
@Controller("me")
export class AccountController {
  constructor(private readonly context: DecafRequestContext) {}

  @Get()
  @ApiOperation({ summary: "Returns the authenticated principal" })
  @ApiOkResponse({ description: "The user, organization, roles and namespaces extracted from the token" })
  whoAmI(): Principal {
    const get = <T>(key: string): T | undefined =>
      this.context.getOrUndefined(key as any) as T | undefined;
    return {
      user: get<string>("user"),
      organization: get<string>("organization"),
      roles: get<string[]>("roles") ?? [],
      namespaces: get<string[]>("namespaces") ?? [],
    };
  }
}
