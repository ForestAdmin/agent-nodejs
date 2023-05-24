import { BaseError } from 'sequelize';

import { DatabaseConnectError, ProxyConnectError } from './errors';
import { ConnectionOptionsObj } from '../types';

export function handleErrors(error: Error, databaseUri: string): void {
  if (error instanceof BaseError) {
    const nameWithoutSequelize = error.name.replace('Sequelize', '');
    const nameWithSpaces = nameWithoutSequelize.replace(
      /([a-z])([A-Z])/g,
      (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
    );

    throw new DatabaseConnectError(`${nameWithSpaces}: ${error.message}`, databaseUri);
  }

  throw error;
}

export function handleErrorsWithProxy(
  error: Error,
  databaseUri: string,
  proxyConfig: ConnectionOptionsObj['proxySocks'],
): void {
  // eslint-disable-next-line max-len
  // @link: list of errors thrown by the proxy https://github.com/JoshGlazebrook/socks/blob/76d013e4c9a2d956f07868477d8f12ec0b96edfc/src/common/constants.ts#LL10C10-L10C10
  if (error.stack.includes('SocksClient')) {
    if (
      error.message.includes('Socket closed') ||
      error.message.includes('Socks5 proxy rejected connection')
    ) {
      throw new DatabaseConnectError(null, databaseUri, 'Proxy');
    }

    throw new ProxyConnectError(error.message, proxyConfig);
  }

  handleErrors(error, databaseUri);
}
