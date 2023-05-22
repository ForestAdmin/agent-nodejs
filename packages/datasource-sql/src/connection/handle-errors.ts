import {
  BaseError,
  ConnectionError,
  HostNotFoundError as SequelizeHostNotFoundError,
} from 'sequelize';

import {
  AccessDeniedError,
  ConnectionAcquireTimeoutError,
  HostNotFoundError,
  UnexpectedProxyError,
} from './errors';

export function handleErrors(error: Error, databaseUri: string): void {
  if (error instanceof SequelizeHostNotFoundError) {
    throw new HostNotFoundError(databaseUri);
  } else if (error instanceof ConnectionError) {
    throw new AccessDeniedError(databaseUri);
  }

  if (error instanceof BaseError) {
    const nameWithoutSequelize = error.name.replace('Sequelize', '');
    const nameWithSpaces = nameWithoutSequelize.replace(
      /([a-z])([A-Z])/g,
      (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
    );

    const newError = new Error(`${nameWithSpaces}: ${error.message}`);
    newError.name = nameWithoutSequelize;

    throw newError;
  }

  throw error;
}

export function handleErrorsWithProxy(error: Error, databaseUri: string): void {
  // eslint-disable-next-line max-len
  // @link: list of errors thrown by the proxy https://github.com/JoshGlazebrook/socks/blob/76d013e4c9a2d956f07868477d8f12ec0b96edfc/src/common/constants.ts#LL10C10-L10C10
  if (error.message.includes('Socket closed')) {
    throw new HostNotFoundError(databaseUri);
  } else if (error.message.includes('Socks5 proxy rejected connection')) {
    if (error.message.includes('HostUnreachable')) {
      throw new HostNotFoundError(databaseUri);
    }

    throw new AccessDeniedError(databaseUri);
  } else if (error.message.includes('Proxy connection timed out')) {
    throw new ConnectionAcquireTimeoutError(databaseUri);
  } else if (error.message.includes('Socks5 Authentication failed')) {
    throw new AccessDeniedError(databaseUri);
  } else if (
    error.message.includes('socks') ||
    error.message.includes('getaddrinfo ENOTFOUND BADHOST') ||
    error.message.includes('connect ECONNREFUSED')
  ) {
    throw new UnexpectedProxyError(databaseUri);
  }

  handleErrors(error, databaseUri);
}
