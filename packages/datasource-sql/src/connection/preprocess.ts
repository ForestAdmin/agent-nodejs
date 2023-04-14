import type { ConnectionOptions, ConnectionOptionsObj, SslMode } from '../types';

import connect from './index';
import { getDialect, getUri } from './utils';

async function resolveSslMode(uriOrOptions: ConnectionOptionsObj): Promise<SslMode> {
  // Try to connect with the different sslModes in order of preference
  if (uriOrOptions.sslMode === 'preferred') {
    // When NODE_TLS_REJECT_UNAUTHORIZED is set to 0, we skip the 'verify' mode, as we know it will
    // always work locally, but not when deploying to another environment.
    const modes = ['verify', 'required', 'disabled'] as SslMode[];
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') modes.shift();

    let error: Error;

    for (const sslMode of modes) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const sequelize = await connect({ ...uriOrOptions, sslMode });
        await sequelize.close(); // eslint-disable-line no-await-in-loop

        return sslMode;
      } catch (e) {
        error = e;
      }
    }

    throw error;
  }

  return uriOrOptions.sslMode ?? 'manual';
}

/**
 * Preprocess connection options.
 * Allows to speed up the connection process by avoiding attempts to connect to the database.
 *
 * It ensures that
 * - both sslMode and dialect are set
 * - the automatic 'preferred' sslMode is resolved to the most appropriate value
 */
export default async function preprocessOptions(
  uriOrOptions: ConnectionOptions,
): Promise<ConnectionOptionsObj> {
  // Extract sanitized dialect and uri from the connection options
  const dialect = getDialect(uriOrOptions);
  const uri = getUri(uriOrOptions, dialect);

  // Create a new object with the sanitized dialect and uri and resolve the sslMode
  const obj =
    typeof uriOrOptions === 'string' ? { uri, dialect } : { ...uriOrOptions, uri, dialect };
  const sslMode = await resolveSslMode(obj);

  return { ...obj, sslMode };
}
