import type { ConnectionOptions } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { BaseError, Dialect } from 'sequelize';

export function checkOptions(uriOrOptions: ConnectionOptions): void {
  const uri = typeof uriOrOptions === 'string' ? uriOrOptions : uriOrOptions.uri;

  if (uri && !/.*:\/\//g.test(uri)) {
    throw new Error(
      `Connection Uri "${uri}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );
  }
}

export function getDialect(uriOrOptions: ConnectionOptions): Dialect {
  if (typeof uriOrOptions === 'string' || uriOrOptions.uri) {
    const uri = new URL(typeof uriOrOptions === 'string' ? uriOrOptions : uriOrOptions.uri);

    if (uri.protocol === 'mariadb:') return 'mariadb';
    if (uri.protocol === 'mysql:' || uri.protocol === 'mysql2:') return 'mysql';
    if (uri.protocol === 'mssql:' || uri.protocol === 'tedious:') return 'mssql';
    if (uri.protocol === 'postgres:' || uri.protocol === 'pg:' || uri.protocol === 'postgresql:')
      return 'postgres';

    return uri.protocol.slice(0, -1) as Dialect;
  }

  return uriOrOptions.dialect;
}

export function getSchema(uri: string): string {
  return uri ? new URL(uri).searchParams.get('schema') : null;
}

export function getLogger(logger: Logger): (sql: string) => void {
  return (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
}

export function rewriteSequelizeErrors(error: Error): void {
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
