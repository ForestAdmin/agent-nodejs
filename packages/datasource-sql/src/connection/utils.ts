import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect } from 'sequelize';

import { SslMode } from '../types';

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
