import type {
  PlainConnectionOptions,
  PlainConnectionOptionsOrUri,
  ProxyOptions,
  SshOptions,
  SslMode,
} from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { Dialect, Sequelize, Options as SequelizeOptions } from 'sequelize';

import { DatabaseConnectError } from './errors';
import connect from './index';

/**
 * Connection options.
 * This wrapper is constructed from a plain object or a URI string.
 *
 * It is capable of parsing them, and providing an interface to the rest of the code to:
 * - Build parameters to create sequelize instances
 * - Build connections options with both dialect and sslmode resolved (for quick startup in cloud)
 * - Provide safe urls for error messages (without credentials)
 * - Play with the host and port without breaking SSL servername / error messages (for the proxy)
 */
export default class ConnectionOptions {
  proxyOptions?: ProxyOptions;
  sshOptions?: SshOptions;
  connectionTimeoutInMs?: number;

  private initialHost: string;
  private initialPort: number;
  private logger?: Logger;
  private sequelizeOptions: SequelizeOptions;
  private sslMode: SslMode;
  private uri?: URL;

  /**
   * Database URI without credentials, which can be used in error messages.
   * Ensure that this is never substituted by the proxy, nor that it includes credentials.
   */
  get debugDatabaseUri(): string {
    const dialect = this.dialect ?? '?';
    const port = this.initialPort ?? '?';
    const database = this.database ?? '?';

    return dialect === 'sqlite'
      ? this.uri?.href ?? `sqlite:${this.sequelizeOptions.storage}`
      : `${dialect}://${this.initialHost}:${port}/${database}`;
  }

  get dialect(): Dialect {
    let dialect = this.uri?.protocol?.slice(0, -1) || this.sequelizeOptions.dialect;
    if (dialect === 'mysql2') dialect = 'mysql';
    else if (dialect === 'tedious') dialect = 'mssql';
    else if (dialect === 'pg' || dialect === 'postgresql') dialect = 'postgres';

    return dialect as Dialect;
  }

  get host(): string {
    return this.uri?.hostname ?? this.sequelizeOptions.host ?? 'localhost';
  }

  get port(): number {
    let port = Number(this.uri?.port) || this.sequelizeOptions.port;

    if (!port) {
      // Use default port for known dialects otherwise
      if (this.dialect === 'postgres') port = 5432;
      else if (this.dialect === 'mssql') port = 1433;
      else if (this.dialect === 'mysql' || this.dialect === 'mariadb') port = 3306;
    }

    return port;
  }

  get database(): string {
    return this.uri?.pathname?.slice(1) || this.sequelizeOptions.database;
  }

  private get plainConnectionOptions(): PlainConnectionOptions {
    const options = { ...this.sequelizeOptions } as PlainConnectionOptions;

    if (this.uri) options.uri = this.uri.toString();
    if (this.proxyOptions) options.proxySocks = this.proxyOptions;
    if (this.sshOptions) options.ssh = this.sshOptions;
    if (this.connectionTimeoutInMs) options.connectionTimeoutInMs = this.connectionTimeoutInMs;
    options.dialect = this.dialect;
    options.sslMode = this.sslMode;

    return options;
  }

  constructor(options: PlainConnectionOptionsOrUri, logger?: Logger) {
    this.logger = logger;

    if (typeof options === 'string') {
      this.uri = this.parseDatabaseUri(options);
      this.sequelizeOptions = {};
    } else {
      const { uri, sslMode, proxySocks, ssh, connectionTimeoutInMs, ...sequelizeOptions } = options;

      this.proxyOptions = proxySocks;
      this.sshOptions = ssh;
      this.connectionTimeoutInMs = connectionTimeoutInMs;
      this.sequelizeOptions = sequelizeOptions;
      this.sslMode = sslMode ?? 'manual';
      this.uri = uri ? this.parseDatabaseUri(uri) : null;
    }

    // Save initial host & port (for SSL and error messages)
    this.initialHost = this.host;
    this.initialPort = this.port;

    // Check required options
    if (!this.dialect) throw new DatabaseConnectError(`Dialect is required`, this.debugDatabaseUri);

    if (this.dialect !== 'sqlite' && !this.port) {
      throw new DatabaseConnectError(`Port is required`, this.debugDatabaseUri);
    }
  }

  changeHostAndPort(host: string, port: number): void {
    // Host
    if (this.uri) this.uri.hostname = host;
    else this.sequelizeOptions.host = host;

    // Port
    if (this.uri) this.uri.port = String(port);
    else this.sequelizeOptions.port = port;
  }

  async buildPreprocessedOptions(): Promise<PlainConnectionOptions> {
    const options = this.plainConnectionOptions;
    options.sslMode = await this.computeSslMode();

    return options;
  }

  /** Options that can be passed to the sequelize constructor */
  async buildSequelizeCtorOptions(): Promise<[SequelizeOptions] | [string, SequelizeOptions]> {
    const options = { ...this.sequelizeOptions };

    options.dialect = this.dialect;
    options.logging = this.makeSequelizeLogging();
    options.schema = this.makeSequelizeSchema();
    options.dialectOptions = {
      ...(options.dialectOptions ?? {}),
      ...(await this.makeSequelizeDialectOptions()),
    };

    return this.uri ? [this.uri.toString(), options] : [options];
  }

  private parseDatabaseUri(str: string): URL {
    const message =
      `Connection Uri "${str}" provided to SQL data source is not valid. ` +
      `Should be <dialect>://<connection>.`;

    if (!str.startsWith('sqlite') && !/.*:\/\//g.test(str)) {
      throw new DatabaseConnectError(message, str);
    }

    try {
      return new URL(str);
    } catch {
      throw new DatabaseConnectError(message, str);
    }
  }

  /** Helper to fill the sequelize's options.schema  */
  private makeSequelizeSchema(): SequelizeOptions['schema'] {
    return this.uri?.searchParams.get('schema') || this.sequelizeOptions.schema || null;
  }

  /** Helper to fill the sequelize's options.logging */
  private makeSequelizeLogging(): SequelizeOptions['logging'] {
    return this.logger
      ? (sql: string) => this.logger?.('Debug', sql.substring(sql.indexOf(':') + 2))
      : false;
  }

  /** Helper to fill the sequelize's options.dialectOptions */
  private async makeSequelizeDialectOptions(): Promise<SequelizeOptions['dialectOptions']> {
    const sslMode = await this.computeSslMode();

    switch (this.dialect) {
      case 'mariadb':
        if (sslMode === 'disabled') return { ssl: false };
        if (sslMode === 'required') return { ssl: { rejectUnauthorized: false } };
        if (sslMode === 'verify') return { ssl: true };
        break;

      case 'mssql':
        if (sslMode === 'disabled') return { options: { encrypt: false } };

        if (sslMode === 'required') {
          return { options: { encrypt: true, trustServerCertificate: true } };
        }

        if (sslMode === 'verify') {
          return { options: { encrypt: true, trustServerCertificate: false } };
        }

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
        if (sslMode === 'required') {
          return {
            ssl: { require: true, rejectUnauthorized: false, servername: this.initialHost },
          };
        }

        if (sslMode === 'verify') {
          return { ssl: { require: true, rejectUnauthorized: true, servername: this.initialHost } };
        }

        break;

      case 'db2':
      case 'oracle':
      case 'snowflake':
      case 'sqlite':
      default:
        if (sslMode && sslMode !== 'manual') {
          this.logger?.('Warn', `ignoring sslMode=${sslMode} (not supported for ${this.dialect})`);
        }

        return {};
    }
  }

  private async computeSslMode(): Promise<SslMode> {
    if (this.sslMode !== 'preferred') {
      return this.sslMode ?? 'manual';
    }

    // When NODE_TLS_REJECT_UNAUTHORIZED is set to 0, we skip the 'verify' mode, as we know it will
    // always work locally, but not when deploying to another environment.
    const modes: SslMode[] = ['verify', 'required', 'disabled'];
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') modes.shift();

    let error: Error;

    for (const sslMode of modes) {
      let sequelize: Sequelize;

      try {
        // eslint-disable-next-line no-await-in-loop
        sequelize = await connect(
          new ConnectionOptions({ ...this.plainConnectionOptions, sslMode }),
        );

        return sslMode;
      } catch (e) {
        error = e;
      } finally {
        await sequelize?.close(); // eslint-disable-line no-await-in-loop
      }
    }

    throw error;
  }
}
