import {
  BaseError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError as SequelizeHostNotFoundError,
} from 'sequelize';

import {
  AccessDeniedError,
  ConnectionAcquireTimeoutError,
  DatabaseError,
  HostNotFoundError,
  ProxyError,
  TooManyConnectionError,
} from './errors';

export function handleErrors(error: Error, databaseUri: string): void {
  if (error instanceof SequelizeHostNotFoundError) throw new HostNotFoundError(databaseUri);

  if (error instanceof ConnectionError) {
    if (error instanceof ConnectionRefusedError || error.message.includes('password'))
      throw new AccessDeniedError(databaseUri);

    // when there is too many connection to the database
    if (error.message.includes('too many')) throw new TooManyConnectionError(databaseUri);

    if (error.message.includes('connect ETIMEDOUT'))
      throw new ConnectionAcquireTimeoutError(databaseUri);
  }

  if (error instanceof BaseError) {
    const nameWithoutSequelize = error.name.replace('Sequelize', '');
    const nameWithSpaces = nameWithoutSequelize.replace(
      /([a-z])([A-Z])/g,
      (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
    );

    throw new DatabaseError(databaseUri, `${nameWithSpaces}: ${error.message}`);
  }

  throw error;
}

export function handleErrorsWithProxy(error: Error, databaseUri: string, proxyUri: string): void {
  // eslint-disable-next-line max-len
  // @link: list of errors thrown by the proxy https://github.com/JoshGlazebrook/socks/blob/76d013e4c9a2d956f07868477d8f12ec0b96edfc/src/common/constants.ts#LL10C10-L10C10
  if (error.message.includes('Socket closed')) {
    throw new HostNotFoundError(databaseUri);
  } else if (error.message.includes('Socks5 proxy rejected connection')) {
    if (error.message.includes('HostUnreachable')) throw new HostNotFoundError(databaseUri);

    throw new AccessDeniedError(databaseUri);
  } else if (error.stack.includes('SocksClient')) {
    throw new ProxyError(proxyUri, error.message);
  }

  handleErrors(error, databaseUri);
}
