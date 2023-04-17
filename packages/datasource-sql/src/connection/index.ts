import type { ConnectionOptions, SslMode } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect, Sequelize } from 'sequelize';

import preprocessOptions from './preprocess';
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

/** Attempt to connect to the database */
export default async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  try {
    const { uri, sslMode, ...opts } = await preprocessOptions(uriOrOptions);
    const schema = opts.schema ?? getSchema(uri);
    const logging = logger ? getLogger(logger) : false;

    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...getSslConfiguration(opts.dialect, sslMode, logger),
    };

    const sequelize = uri
      ? new Sequelize(uri, { ...opts, schema, logging })
      : new Sequelize({ ...opts, schema, logging });

    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    handleSequelizeError(e as Error);
  }
}
