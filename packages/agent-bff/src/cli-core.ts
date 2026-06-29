import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';
import { parseConfig } from './config/env-config';
import { extractErrorMessage } from './errors';
import BFFHttpServer from './http/bff-http-server';
import version from './version';

export default async function runCli(
  env: NodeJS.ProcessEnv,
  logger: Logger = createConsoleLogger(),
): Promise<BFFHttpServer> {
  const config = parseConfig(env);
  const server = new BFFHttpServer({ port: config.httpPort, version, config, logger });

  await server.start();

  return server;
}

export function reportFatalError(err: unknown): void {
  process.stderr.write(`Error: ${extractErrorMessage(err)}\n`);
  process.exitCode = 1;
}
