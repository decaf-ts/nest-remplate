/**
 * @module nest-template/main
 * @description Process entrypoint: `node lib/main.js`.
 */
import { Logging } from "@decaf-ts/logging";
import { createApp } from "./bootstrap";
import { AppEnvironment } from "./config/environment";

/**
 * @description Boots the application and starts listening on `HOST:PORT`.
 * @return {Promise<void>}
 * @function main
 */
async function main(): Promise<void> {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(AppEnvironment.port, AppEnvironment.host);
  Logging.for("nest-template").info(
    `Listening on http://${AppEnvironment.host}:${AppEnvironment.port} (docs: /docs, events: ${AppEnvironment.events.path})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
