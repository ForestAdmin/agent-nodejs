import { BaseError as SequelizeError } from 'sequelize';

import ConnectionOptions from './connection-options';
import { DatabaseConnectError, ProxyConnectError, SshConnectError } from './errors';

function handleProxyErrors(error: Error, options: ConnectionOptions): void {
  /** @see https://github.com/JoshGlazebrook/socks/blob/76d013/src/common/constants.ts#L10 */
  if (
    error.message.includes('Socket closed') ||
    error.message.includes('Socks5 proxy rejected connection')
  ) {
    // means that the ssh is not reachable
    if (options.sshOptions) {
      throw new SshConnectError(error.message, options.debugSshUri);
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

export default function handleErrors(error: Error, options: ConnectionOptions) {
  if (error?.stack?.includes('SocksClient')) {
    handleProxyErrors(error, options);
  }

  if (error?.stack?.includes('ssh2')) {
    throw new SshConnectError(error.message, options.debugSshUri);
  }

  if (error instanceof SequelizeError) {
    handleSequelizeError(error, options);
  }

  throw error;
}
