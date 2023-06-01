import type { ConnectionOptions } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect } from 'sequelize';

import { DatabaseConnectError } from './errors';
import { SslMode } from '../types';

function checkUri(uri: string): void {
  if (!/.*:\/\//g.test(uri) && uri !== 'sqlite::memory:') {
    throw new DatabaseConnectError(
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
    throw new DatabaseConnectError('Expected dialect to be provided in options or uri.');
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

export function getSslConfiguration(
  dialect: Dialect,
  sslMode: SslMode,
  servername?: string,
  logger?: Logger,
): Record<string, unknown> {
  switch (dialect) {
    case 'mariadb':
      if (sslMode === 'disabled') return { ssl: false };
      if (sslMode === 'required') return { ssl: { rejectUnauthorized: false } };
      if (sslMode === 'verify') return { ssl: true };
      break;

    case 'mssql':
      if (sslMode === 'disabled') return { options: { encrypt: false } };
      if (sslMode === 'required')
        return { options: { encrypt: true, trustServerCertificate: true } };
      if (sslMode === 'verify')
        return { options: { encrypt: true, trustServerCertificate: false } };
      break;

    case 'mysql':
      if (sslMode === 'disabled') return { ssl: false };
      if (sslMode === 'required') return { ssl: { rejectUnauthorized: false } };
      if (sslMode === 'verify') return { ssl: { rejectUnauthorized: true } };
      break;

    case 'postgres':
      if (sslMode === 'disabled') return { ssl: false };

      // Pass servername to the net.tlsSocket constructor.

      // This is done so that
      // - Certificate verification still work when using a proxy server to reach the db (we are
      //   forced to use a tcp reverse proxy because some drivers do not support them)
      // - Providers which use SNI to route requests to the correct database still work (most
      //   notably neon.tech).

      // Note that we should either do that for the other vendors (if possible), or
      // replace the reverse proxy by a forward proxy (when supported).
      if (sslMode === 'required')
        return { ssl: { require: true, rejectUnauthorized: false, servername } };
      if (sslMode === 'verify')
        return { ssl: { require: true, rejectUnauthorized: true, servername } };
      break;

    case 'db2':
    case 'oracle':
    case 'snowflake':
    case 'sqlite':
    default:
      if (sslMode && sslMode !== 'manual') {
        logger?.('Warn', `ignoring sslMode=${sslMode} (not supported for ${dialect})`);
      }

      return {};
  }
}
