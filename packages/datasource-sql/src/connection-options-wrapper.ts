import { Dialect } from 'sequelize';

import { DatabaseConnectError } from './connection/errors';
import { ConnectionOptions, ConnectionOptionsObj } from './types';

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
    if (this.uri.port) return Number(this.uri.port);
    if (this.originalOptions.port) return this.originalOptions.port;

    // Use default port for known dialects otherwise
    if (this.originalOptions.dialect === 'postgres') return 5432;
    if (this.originalOptions.dialect === 'mssql') return 1433;
    if (this.originalOptions.dialect === 'mysql' || this.originalOptions.dialect === 'mariadb')
      return 3306;
  }

  get hostFromUriOrOptions(): string {
    return this.uri.hostname || this.originalOptions.host;
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
      return this.checkUri().uriAsString;
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

  get dialect(): Dialect {
    let dialect: string;

    if (this.originalOptions.dialect) {
      dialect = this.originalOptions.dialect;
    } else if (this.uriAsString) {
      dialect = new URL(this.uriAsString).protocol.slice(0, -1);
    }

    if (dialect === 'mysql2') return 'mysql';
    if (dialect === 'tedious') return 'mssql';
    if (dialect === 'pg' || dialect === 'postgresql') return 'postgres';

    return dialect as Dialect;
  }

  get schemaFromUriOrOptions(): string {
    return this.originalOptions.uri
      ? new URL(this.originalOptions.uri).searchParams.get('schema')
      : this.originalOptions.schema;
  }

  checkUri(): this {
    const message =
      `Connection Uri "${this.originalOptions.uri}" provided to SQL data source is not valid.` +
      ' Should be <dialect>://<connection>.';

    try {
      if (this.uriAsString === 'sqlite::memory:') return this;
    } catch (err) {
      throw new DatabaseConnectError(message);
    }

    if (!/.*:\/\//g.test(this.uriAsString)) throw new DatabaseConnectError(message);
    if (!this.portFromUriOrOptions) throw new DatabaseConnectError('Port is required');
    if (!this.hostFromUriOrOptions) throw new DatabaseConnectError('Host is required');
    if (!this.dialect) throw new DatabaseConnectError('Dialect is required');

    return this;
  }
}
