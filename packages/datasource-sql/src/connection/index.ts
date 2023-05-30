import type { ConnectionOptions, SslMode } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect, Sequelize } from 'sequelize';

import preprocessOptions from './preprocess';
import ReverseProxy from './reverse-proxy';
import { getLogger, getSchema, handleSequelizeError } from './utils';

function getSslConfiguration(
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

/** Attempt to connect to the database */
export default async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  let proxy: ReverseProxy | undefined;
  let sequelize: Sequelize | undefined;

  try {
    let options = await preprocessOptions(uriOrOptions);
    let servername: string;

    try {
      servername = options?.host ?? new URL(options.uri).hostname;
    } catch {
      servername = undefined; // don't crash if using unix socket, sqlite, etc...
    }

    if (options.proxySocks) {
      proxy = new ReverseProxy(options);
      await proxy.start();
      options = proxy.connectionOptions;
    }

    const { uri, sslMode, ...opts } = options;
    const schema = opts.schema ?? getSchema(uri);
    const logging = logger ? getLogger(logger) : false;

    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...getSslConfiguration(opts.dialect, sslMode, servername, logger),
    };

    sequelize = uri
      ? new Sequelize(uri, { ...opts, schema, logging })
      : new Sequelize({ ...opts, schema, logging });

    // we want to stop the proxy when the sequelize connection is closed
    sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        await proxy?.stop();
      }
    };

    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if proxy encountered an error, we want to throw it instead of the sequelize error
    handleSequelizeError(proxy?.error || (e as Error));
  }
}
