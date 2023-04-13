/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ConnectionOptions, SslMode } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect, Sequelize } from 'sequelize';

import { checkOptions, getDialect, getLogger, getSchema, rewriteSequelizeErrors } from './utils';

/** Attempt to connect to the database */
export async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  const { uri, sslMode, ...opts } = await preprocessOptions(uriOrOptions);
  const schema = opts.schema ?? getSchema(uri);
  const logging = logger ? getLogger(logger) : false;

  // Handle sslMode
  opts.dialectOptions = {
    ...(opts.dialectOptions ?? {}),
    ...getSslConfiguration(opts.dialect, sslMode, logger),
  };

  // Test connection
  const sequelize = uri
    ? new Sequelize(uri, { ...opts, schema, logging })
    : new Sequelize({ ...opts, schema, logging });

  try {
    await sequelize.authenticate();
  } catch (e) {
    rewriteSequelizeErrors(e as Error);
  }

  return sequelize;
}

/**
 * Preprocess connection options.
 * Allows to speed up the connection process by avoiding attempts to connect to the database.
 *
 * It ensures that
 * - options are always an object
 * - sslMode !== "preferred"
 * - dialect is always set (for cloud deployments)
 */
export async function preprocessOptions(
  uriOrOptions: ConnectionOptions,
): Promise<Exclude<ConnectionOptions, string>> {
  checkOptions(uriOrOptions);

  const dialect = getDialect(uriOrOptions);

  if (typeof uriOrOptions === 'string') {
    return { uri: uriOrOptions, dialect, sslMode: 'manual' };
  }

  if (uriOrOptions.sslMode === 'preferred') {
    let error: Error;

    for (const sslMode of ['verify', 'required', 'disabled'] as SslMode[]) {
      try {
        // Test connection with the current sslMode (connect then close)
        // eslint-disable-next-line no-await-in-loop
        await connect({ ...uriOrOptions, sslMode }).then(s => s.close());

        return { ...uriOrOptions, sslMode, dialect };
      } catch (e) {
        error = e;
      }
    }

    throw error;
  }

  return { ...uriOrOptions, dialect };
}

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
