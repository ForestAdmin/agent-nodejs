#!/usr/bin/env node
import http from 'http';

import { resolveListenPort } from './gateway-env';
import { HEALTH_PATH } from './standalone-handler';

const HTTP_OK = 200;
const PROBE_TIMEOUT_MS = 4000;

export default async function probeHealth(
  env: NodeJS.ProcessEnv,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<string | undefined> {
  let port: number;

  try {
    port = resolveListenPort(env);
  } catch (error) {
    return (error as Error).message;
  }

  if (port === 0) return 'PORT=0 binds a port chosen by the OS, which cannot be probed';

  return new Promise(resolve => {
    const request = http.get(
      { host: 'localhost', port, path: HEALTH_PATH, timeout: timeoutMs },
      response => {
        response.resume();
        resolve(
          response.statusCode === HTTP_OK
            ? undefined
            : `${HEALTH_PATH} on port ${port} answered ${response.statusCode}`,
        );
      },
    );

    request.on('timeout', () => request.destroy(new Error(`timed out after ${timeoutMs}ms`)));
    request.on('error', (error: NodeJS.ErrnoException) =>
      resolve(`${HEALTH_PATH} on port ${port}: ${error.code ?? error.message}`),
    );
  });
}

/* istanbul ignore next */
if (require.main === module) {
  probeHealth(process.env).then(failure => {
    if (failure === undefined) return;

    process.stderr.write(`${failure}\n`);
    process.exitCode = 1;
  });
}
