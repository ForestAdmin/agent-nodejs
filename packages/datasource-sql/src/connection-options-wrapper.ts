import { Dialect } from 'sequelize';

import { DatabaseConnectError } from './connection/errors';
import { ConnectionOptions, ConnectionOptionsObj, ProxySocks, SslMode } from './types';

export default class ConnectionOptionsWrapper {
  public readonly originalOptions: ConnectionOptionsObj;

  constructor(options: ConnectionOptions) {
    if (!options) throw new Error('Options are required');

    if (typeof options === 'string') {
      this.originalOptions = { uri: options } as ConnectionOptionsObj;
    } else {
      this.originalOptions = options;
    }

    this.checkUri();
  }

  get sslMode(): SslMode {
    return this.originalOptions.sslMode;
  }

  get proxySocks(): ProxySocks {
    return this.originalOptions.proxySocks;
  }

  get port(): number {
    if (this.uri.port) return Number(this.uri.port);
    // Use default port for known dialects otherwise
    if (this.originalOptions.dialect === 'postgres') return 5432;
    if (this.originalOptions.dialect === 'mssql') return 1433;
    if (this.originalOptions.dialect === 'mysql' || this.originalOptions.dialect === 'mariadb')
      return 3306;
  }

  get host(): string {
    return this.uri.hostname;
  }

  get sanitizedProxySocksAsUriString(): string {
    const proxyUri = new URL(`socks://${this.proxySocks.host}:${this.proxySocks.port}`);
    if (this.proxySocks.userId) proxyUri.username = this.proxySocks.userId;
    if (this.proxySocks.password) proxyUri.password = this.proxySocks.password;

    return ConnectionOptionsWrapper.sanitizeUri(proxyUri.toString()).replace('socks://', '');
  }

  get uri(): URL {
    const uriObject = this.originalOptions.uri
      ? new URL(this.originalOptions.uri)
      : new URL(`${this.originalOptions.dialect}://`);

    if (this.originalOptions.database) uriObject.pathname = this.originalOptions.database;
    if (this.originalOptions.host) uriObject.host = this.originalOptions.host;
    if (this.originalOptions.port) uriObject.port = this.originalOptions.port.toString();
    if (this.originalOptions.username) uriObject.username = this.originalOptions.username;
    if (this.originalOptions.password) uriObject.password = this.originalOptions.password;
    if (this.originalOptions.dialect) uriObject.protocol = this.originalOptions.dialect;

    return uriObject;
  }

  get uriAsString(): string {
    return this.uri.toString();
  }

  get sanitizedUriAsString(): string {
    return ConnectionOptionsWrapper.sanitizeUri(this.uriAsString);
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

  private checkUri(): void {
    const message =
      `Connection Uri "${this.originalOptions.uri}" provided to SQL data source is not valid.` +
      ' Should be <dialect>://<connection>.';

    try {
      if (this.uriAsString === 'sqlite::memory:') return;
    } catch (err) {
      throw new DatabaseConnectError(message);
    }

    if (!/.*:\/\//g.test(this.uriAsString)) throw new DatabaseConnectError(message);
    if (!this.port) throw new DatabaseConnectError('Port is required');
    if (!this.host) throw new DatabaseConnectError('Host is required');
    if (!this.dialect) throw new DatabaseConnectError('Dialect is required');
  }

  private static sanitizeUri(uri: string): string {
    const uriObject = new URL(uri);

    if (uriObject.password) {
      uriObject.password = '**sanitizedPassword**';
    }

    return uriObject.toString();
  }
}
