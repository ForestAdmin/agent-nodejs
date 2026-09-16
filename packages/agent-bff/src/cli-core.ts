import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';
import buildBff from './build-bff';
import { parseConfig } from './config/env-config';
import { extractErrorMessage } from './errors';
import BFFHttpServer from './http/bff-http-server';

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

let installedShutdownHandlers: { signal: NodeJS.Signals; handler: () => void }[] = [];

/**
 * Routes a termination signal to `stop()`, which drains the activity-log transitions no connection
 * holds. Registered here rather than in the server: an embedded deployment does not own the process
 * signals, so the drain has to be reachable through `stop()` instead.
 *
 * A process runs one BFF, so a second call replaces the handlers instead of adding a pair: the
 * signal must reach the server that is listening, and nothing else.
 */
export function installShutdownHandlers(server: BFFHttpServer, logger: Logger): void {
  for (const { signal, handler } of installedShutdownHandlers) {
    process.removeListener(signal, handler);
  }

  installedShutdownHandlers = SHUTDOWN_SIGNALS.map(signal => {
    const handler = () => {
      logger('Info', 'Stopping the Forest BFF', { signal });

      server.stop().catch(error => {
        logger('Error', 'The Forest BFF did not stop cleanly', {
          cause: extractErrorMessage(error),
        });
      });
    };

    process.on(signal, handler);

    return { signal, handler };
  });
}

export default async function runCli(
  env: NodeJS.ProcessEnv,
  logger: Logger = createConsoleLogger(),
): Promise<BFFHttpServer> {
  const config = parseConfig(env);
  const { callback, drainActivityLogs } = await buildBff({ config, logger });

  const server = new BFFHttpServer({
    port: config.httpPort,
    config,
    logger,
    callback,
    drainActivityLogs,
  });

  await server.start();
  installShutdownHandlers(server, logger);

  return server;
}

export function reportFatalError(err: unknown): void {
  process.stderr.write(`Error: ${extractErrorMessage(err)}\n`);
  process.exitCode = 1;
}
