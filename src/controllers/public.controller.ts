/**
 * @module nest-template/controllers/public
 * @description Unauthenticated endpoints.
 */
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "@decaf-ts/for-nest";
import { VERSION } from "../version";

/**
 * @description Service status.
 * @interface ServiceStatus
 */
export interface ServiceStatus {
  name: string;
  version: string;
  status: "ok";
  uptime: number;
}

/**
 * @description `GET /public/status` — liveness/readiness probe.
 * @summary Public twice over: `@Public()` skips the auth interceptor for the route, and the
 * `/public` prefix is treated as public by the Keycloak auth handler (see `PUBLIC_PATHS`).
 * @class PublicController
 */
@ApiTags("Public")
@Public()
@Controller("public")
export class PublicController {
  @Get("status")
  @ApiOperation({ summary: "Service status (no authentication required)" })
  @ApiOkResponse({ description: "The service is up" })
  status(): ServiceStatus {
    return {
      name: "@decaf-ts/nest-template",
      version: VERSION,
      status: "ok",
      uptime: Math.round(process.uptime()),
    };
  }
}
