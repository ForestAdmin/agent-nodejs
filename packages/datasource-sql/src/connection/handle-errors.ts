import { BaseError as SequelizeError } from 'sequelize';

import { DatabaseConnectError, ProxyConnectError } from './errors';
import ReverseProxy from './reverse-proxy';
import ConnectionOptionsWrapper from '../connection-options-wrapper';
import { ConnectionOptionsObj } from '../types';

function handleProxyErrors(error: Error, proxy: ReverseProxy): void {
  /** @see https://github.com/JoshGlazebrook/socks/blob/76d013/src/common/constants.ts#L10 */
  if (
    error.message.includes('Socket closed') ||
    error.message.includes('Socks5 proxy rejected connection')
  ) {
    throw new DatabaseConnectError(null, proxy.wrapperOptions, 'Proxy');
  }

  throw new ProxyConnectError(error.message, proxy?.wrapperOptions);
}

function handleSequelizeError(error: SequelizeError, options?: ConnectionOptionsObj): void {
  const nameWithoutSequelize = error.name.replace('Sequelize', '');
  const nameWithSpaces = nameWithoutSequelize.replace(
    /([a-z])([A-Z])/g,
    (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
  );

  throw new DatabaseConnectError(
    `${nameWithSpaces}: ${error.message}`,
    options ? new ConnectionOptionsWrapper(options) : null,
  );
}

export default function handleErrors(
  error: Error,
  options?: ConnectionOptionsObj,
  proxy?: ReverseProxy,
) {
  if (error?.stack?.includes('SocksClient')) {
    handleProxyErrors(error, proxy);
  }

  if (error instanceof SequelizeError) {
    handleSequelizeError(error, options);
  }

  throw error;
}
