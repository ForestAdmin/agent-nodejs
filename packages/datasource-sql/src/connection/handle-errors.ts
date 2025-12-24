import type ConnectionOptions from './connection-options';

import { BaseError as SequelizeError } from 'sequelize';

import {
  DatabaseConnectError,
  ProxyForwardError,
  SshConnectError,
  SshForwardError,
} from './errors';

export default function handleErrors(error: Error, options: ConnectionOptions) {
  if (error instanceof ProxyForwardError) {
    // means that the ssh is not reachable
    if (options.sshOptions) {
      throw new SshConnectError(null, error.debugUri, 'Proxy');
    } else {
      // if there is no sshOptions, then the database is the destination and
      // it means that the database is not reachable
      throw new DatabaseConnectError(null, error.debugUri, 'Proxy');
    }
  }

  // it means that the database is not reachable
  if (error instanceof SshForwardError) {
    throw new DatabaseConnectError(null, error.debugUri, 'Ssh');
  }

  if (error instanceof SequelizeError) {
    const nameWithoutSequelize = error.name.replace('Sequelize', '');
    const nameWithSpaces = nameWithoutSequelize.replace(
      /([a-z])([A-Z])/g,
      (_, m1, m2) => `${m1} ${m2.toLowerCase()}`,
    );

    throw new DatabaseConnectError(`${nameWithSpaces}: ${error.message}`, options.debugDatabaseUri);
  }

  throw error;
}
