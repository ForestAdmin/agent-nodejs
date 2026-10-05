import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';
import buildBff from './build-bff';
import { parseConfig } from './config/env-config';
import { extractErrorMessage } from './errors';
import BFFHttpServer, { DEFAULT_SERVER_NAME } from './http/bff-http-server';

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
export interface Stoppable {
  stop(): Promise<void>;
}

export function installShutdownHandlers(
  target: Stoppable,
  logger: Logger,
  { name = DEFAULT_SERVER_NAME }: { name?: string } = {},
): void {
  for (const { signal, handler } of installedShutdownHandlers) {
    process.removeListener(signal, handler);
  }

  let stopping = false;

  installedShutdownHandlers = SHUTDOWN_SIGNALS.map(signal => {
    const handler = () => {
      if (stopping) {
        logger('Info', `Ignoring the signal: the ${name} is already stopping`, { signal });

        return;
      }

      stopping = true;
      logger('Info', `Stopping the ${name}`, { signal });

      target.stop().catch(error => {
        logger('Error', `The ${name} did not stop cleanly`, {
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
