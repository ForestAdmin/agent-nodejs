import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect } from 'sequelize';

import { DatabaseConnectError } from './connection/errors';
import { ConnectionOptions, ConnectionOptionsObj, SslMode } from './types';

export default class ConnectionOptionsWrapper {
  private readonly originalOptions: ConnectionOptionsObj;

  constructor(options: ConnectionOptions) {
    if (!options) throw new Error('Options are required');

    if (typeof options === 'string') {
      this.originalOptions = { uri: options } as ConnectionOptionsObj;
    } else {
      this.originalOptions = options;
    }
  }

  get options(): ConnectionOptionsObj {
    return { ...this.originalOptions };
  }

  get portFromUriOrOptions(): number {
    let port: number;
    port = Number(this.uri?.port) || this.originalOptions.port;
    if (port) return port;
    const { dialect } = this.originalOptions;
    // Use default port for known dialects otherwise
    if (dialect === 'postgres') port = 5432;
    if (dialect === 'mssql') port = 1433;
    if (dialect === 'mysql' || dialect === 'mariadb') port = 3306;

    return port;
  }

  get hostFromUriOrOptions(): string {
    return this.uri?.hostname || this.originalOptions.host;
  }

  get proxyUriAsString(): string {
    if (!this.originalOptions.proxySocks) return null;

    const proxy = this.originalOptions.proxySocks;
    const proxyUri = new URL(`tcp://${proxy.host}:${proxy.port}`);
    if (proxy.userId) proxyUri.username = proxy.userId;
    if (proxy.password) proxyUri.password = proxy.password;

    return proxyUri.toString();
  }

  get uriIfValidOrNull(): string {
    try {
      this.checkUri();

      return this.uriAsString;
    } catch (err) {
      return null;
    }
  }

  get uri(): URL {
    return this.originalOptions.uri ? new URL(this.originalOptions.uri) : null;
  }

  get uriAsString(): string {
    return this.uri?.toString();
  }

  get dialectFromUriOrOptions(): Dialect {
    const dialect = this.uri?.protocol?.slice(0, -1) || this.originalOptions.dialect;
    if (dialect === 'mysql2') return 'mysql';
    if (dialect === 'tedious') return 'mssql';
    if (dialect === 'pg' || dialect === 'postgresql') return 'postgres';

    return dialect as Dialect;
  }

  get schemaFromUriOrOptions(): string {
    return this.uri?.searchParams.get('schema') || this.originalOptions.schema || null;
  }

  checkUri(): void {
    const message =
      `Connection Uri "${this.originalOptions.uri}" provided to SQL data source is not valid.` +
      ' Should be <dialect>://<connection>.';

    try {
      if (this.uriAsString === 'sqlite::memory:') return;
    } catch (err) {
      throw new DatabaseConnectError(message);
    }

    if (this.uriAsString && !/.*:\/\//g.test(this.uriAsString))
      throw new DatabaseConnectError(message);
    if (!this.portFromUriOrOptions) throw new DatabaseConnectError('Port is required');
    if (!this.hostFromUriOrOptions) throw new DatabaseConnectError('Host is required');
    if (!this.dialectFromUriOrOptions) throw new DatabaseConnectError('Dialect is required');
  }

  computeSslConfiguration(
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
}
