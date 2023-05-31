import type { ConnectionOptions, ConnectionOptionsObj, ProxySocks, SslMode } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect, Sequelize } from 'sequelize';

import preprocessOptions from './preprocess';
import ReverseProxy from './reverse-proxy';
import SshClient from './ssh-client';
import { getLogger, getSchema, handleSequelizeError } from './utils';

function getSslConfiguration(
  dialect: Dialect,
  sslMode: SslMode,
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
      if (sslMode === 'required') return { ssl: { require: true, rejectUnauthorized: false } };
      if (sslMode === 'verify') return { ssl: { require: true, rejectUnauthorized: true } };
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

async function startProxy(options: ConnectionOptionsObj): Promise<ReverseProxy> {
  let proxy: ReverseProxy | undefined;

  if (options.ssh) {
    // destination is now the ssh server
    proxy = new ReverseProxy({
      port: options.ssh.port,
      host: options.ssh.host,
      proxySocks: options.proxySocks as ProxySocks,
    });
    // open a ssh connection when the proxy receives a connection
    proxy.on('connect', async socket => {
      await new SshClient(socket, options).connect();
    });
  } else {
    proxy = new ReverseProxy(options);
  }

  await proxy.start();

  return proxy;
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

    if (options.proxySocks) {
      proxy = await startProxy(options);
      options = proxy.updateConnectionOptions(options);
    }

    const { uri, sslMode, ...opts } = options;
    const schema = opts.schema ?? getSchema(uri);
    const logging = logger ? getLogger(logger) : false;

    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...getSslConfiguration(opts.dialect, sslMode, logger),
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
