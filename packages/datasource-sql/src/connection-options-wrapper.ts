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
    if (!this.originalOptions.proxySocks) return undefined;

    return this.originalOptions.proxySocks;
  }

  get port(): number {
    if (this.originalOptions.port) return this.originalOptions.port;
    if (this.originalOptions.uri && new URL(this.originalOptions.uri).port)
      return Number(new URL(this.originalOptions.uri).port);

    // Use default port for known dialects otherwise
    if (this.originalOptions.dialect === 'postgres') return 5432;
    if (this.originalOptions.dialect === 'mysql' || this.originalOptions.dialect === 'mariadb')
      return 3306;
    if (this.originalOptions.dialect === 'mssql') return 1433;
  }

  get host(): string {
    return this.originalOptions.uri
      ? new URL(this.originalOptions.uri).hostname
      : this.originalOptions.host;
  }

  get sanitizedProxySocksAsUriString(): string {
    const proxyUri = new URL(`socks://${this.proxySocks.host}:${this.proxySocks.port}`);
    if (this.proxySocks.userId) proxyUri.username = this.proxySocks.userId;
    if (this.proxySocks.password) proxyUri.password = this.proxySocks.password;

    return ConnectionOptionsWrapper.sanitizeUri(proxyUri.toString()).replace('socks://', '');
  }

  get uriAsString(): string {
    if (this.originalOptions.uri) return this.originalOptions.uri;
    const uriObject = new URL(`${this.originalOptions.dialect}://`);

    if (this.originalOptions.database) uriObject.pathname = this.originalOptions.database;
    if (this.originalOptions.host) uriObject.host = this.originalOptions.host;
    if (this.originalOptions.port) uriObject.port = this.originalOptions.port.toString();
    if (this.originalOptions.username) uriObject.username = this.originalOptions.username;
    if (this.originalOptions.password) uriObject.password = this.originalOptions.password;

    let uri = uriObject.toString();
    if (!this.originalOptions.dialect) uri = uri.split('://').pop() as string;

    return uri;
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
    if (this.uriAsString === 'sqlite::memory:') return;

    let message: string;
    if (!this.port) message = 'Port is required';
    if (!this.host) message = 'Host is required';
    if (!this.dialect) message = 'Expected dialect to be provided in options or uri.';

    if (!/.*:\/\//g.test(this.uriAsString)) {
      message =
        `Connection Uri "${this.uriAsString}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.';
    }

    if (message) throw new DatabaseConnectError(message);
  }

  private static sanitizeUri(uri: string): string {
    const uriObject = new URL(uri);

    if (uriObject.password) {
      uriObject.password = '**sanitizedPassword**';
    }

    return uriObject.toString();
  }
}
