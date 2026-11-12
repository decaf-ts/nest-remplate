/**
 * Jest setup: keeps decaf's logger quiet during the suites (the e2e suites trigger many
 * expected 401/403/404/422 responses that the exception filter would otherwise log).
 * Set TEST_LOG_LEVEL=info|debug|verbose to see the application logs.
 */
import { Logging, LogLevel } from "@decaf-ts/logging";

Logging.setConfig({
  level: (process.env.TEST_LOG_LEVEL as LogLevel) ?? LogLevel.fatal,
});
