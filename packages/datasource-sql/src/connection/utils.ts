import type { ConnectionOptions } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect } from 'sequelize';

function checkUri(uri: string): void {
  if (!/.*:\/\//g.test(uri) && uri !== 'sqlite::memory:') {
    throw new Error(
      `Connection Uri "${uri}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );
  }
}

export function getUri(uriOrOptions: ConnectionOptions, dialect: Dialect): string | null {
  const uri = typeof uriOrOptions === 'string' ? uriOrOptions : uriOrOptions.uri;

  if (uri) {
    checkUri(uri);

    const url = new URL(uri);
    url.protocol = dialect;

    return url.toString();
  }

  return null;
}

export function getDialect(uriOrOptions: ConnectionOptions): Dialect {
  let dialect: string;

  if (typeof uriOrOptions !== 'string' && uriOrOptions.dialect) {
    dialect = uriOrOptions.dialect;
  } else if (typeof uriOrOptions === 'string' || uriOrOptions.uri) {
    const uri = typeof uriOrOptions === 'string' ? uriOrOptions : uriOrOptions.uri;
    checkUri(uri);

    dialect = new URL(uri).protocol.slice(0, -1);
  } else {
    throw new Error('Expected dialect to be provided in options or uri.');
  }

  if (dialect === 'mysql2') return 'mysql';
  if (dialect === 'tedious') return 'mssql';
  if (dialect === 'pg' || dialect === 'postgresql') return 'postgres';

  return dialect as Dialect;
}

export function getSchema(uri: string): string {
  return uri ? new URL(uri).searchParams.get('schema') : null;
}

export function getLogger(logger: Logger): (sql: string) => void {
  return (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
}
