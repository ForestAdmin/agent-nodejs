import { BaseError as SequelizeError } from 'sequelize';

import ConnectionOptions from './connection-options';
import { DatabaseConnectError, ProxyConnectError, SshConnectError } from './errors';
import { SocksProxyServiceError, SshForwardServiceError, SshServiceError } from './services/errors';

function handleProxyErrors(error: SocksProxyServiceError, options: ConnectionOptions): void {
  /** @see https://github.com/JoshGlazebrook/socks/blob/76d013/src/common/constants.ts#L10 */
  if (
    error.message.includes('Socket closed') ||
    error.message.includes('Socks5 proxy rejected connection')
  ) {
    // means that the ssh is not reachable
    if (options.sshOptions) {
      throw new SshConnectError(null, options.debugSshUri, 'Proxy');
    } else {
      // if there is no sshOptions, then the database is the destination and
      // it means that the database is not reachable
      throw new DatabaseConnectError(null, options.debugDatabaseUri, 'Proxy');
    }
  }

  throw new ProxyConnectError(error.message, options.debugProxyUri);
}

function handleSequelizeError(error: SequelizeError, options: ConnectionOptions): void {
  const nameWithoutSequelize = error.name.replace('Sequelize', '');
  const nameWithSpaces = nameWithoutSequelize.replace(
    /([a-z])([A-Z])/g,
    (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
  );

  throw new DatabaseConnectError(`${nameWithSpaces}: ${error.message}`, options.debugDatabaseUri);
}

function handleSshErrors(error: SshServiceError, options: ConnectionOptions): void {
  if (error instanceof SshForwardServiceError) {
    throw new DatabaseConnectError(null, options.debugDatabaseUri, 'Ssh');
  } else {
    throw new SshConnectError(error.message, options.debugSshUri);
  }
}

export default function handleErrors(error: Error, options: ConnectionOptions) {
  if (error instanceof SocksProxyServiceError) {
    handleProxyErrors(error, options);
  }

  if (error instanceof SshServiceError) {
    handleSshErrors(error, options);
  }

  if (error instanceof SequelizeError) {
    handleSequelizeError(error, options);
  }

  throw error;
}
