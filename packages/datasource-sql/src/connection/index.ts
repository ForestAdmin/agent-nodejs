/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ConnectionOptions, SslMode } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Dialect, Sequelize } from 'sequelize';

import { checkOptions, getDialect, getLogger, getSchema, handleSequelizeErrors } from './utils';

/** Attempt to connect to the database */
export async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  const { uri, sslMode, ...opts } = await preprocessOptions(uriOrOptions);

  // Handle sslMode
  if (sslMode && sslMode !== 'manual') {
    // By default, sslMode is 'manual' and the user is responsible for providing the ssl
    // configuration in the dialectOptions (ensures that we don't break retro-compatibility)
    const ssl = getSslConfiguration(opts.dialect, sslMode, logger);
    const dialectOptions: Record<string, unknown> = { ...(opts.dialectOptions ?? {}) };
    if (ssl === null) delete dialectOptions.ssl;
    else if (ssl !== undefined) dialectOptions.ssl = ssl;

    opts.dialectOptions = dialectOptions;
  }

  // Connect
  const schema = opts.schema ?? getSchema(uri);
  const logging = logger ? getLogger(logger) : false;
  let sequelize: Sequelize;

  if (uri) {
    sequelize = new Sequelize(uri, { ...opts, schema, logging });
  } else {
    sequelize = new Sequelize({ ...opts, logging });
  }

  // Test connection
  try {
    await sequelize.authenticate();
  } catch (e) {
    handleSequelizeErrors(e as Error);
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

function getSslConfiguration(dialect: Dialect, sslMode: SslMode, logger?: Logger): unknown {
  switch (dialect) {
    case 'mariadb':
      if (sslMode === 'disabled') return null;
      if (sslMode === 'required') return { rejectUnauthorized: false };
      if (sslMode === 'verify') return true;
      break;

    case 'mssql':
      if (sslMode === 'disabled') return null;
      if (sslMode === 'required') return { encrypt: true, trustServerCertificate: true };
      if (sslMode === 'verify') return { encrypt: true, trustServerCertificate: false };
      break;

    case 'mysql':
      if (sslMode === 'disabled') return null;
      if (sslMode === 'required') return { rejectUnauthorized: false };
      if (sslMode === 'verify') return { rejectUnauthorized: true };
      break;

    case 'postgres':
      if (sslMode === 'disabled') return null;
      if (sslMode === 'required') return { require: true, rejectUnauthorized: false };
      if (sslMode === 'verify') return { require: true, rejectUnauthorized: true };
      break;

    case 'db2':
    case 'oracle':
    case 'snowflake':
    case 'sqlite':
    default:
      if (sslMode && sslMode !== 'manual') {
        logger?.('Warn', `ignoring sslMode=${sslMode} (not supported for ${dialect})`);
      }

      return undefined;
  }
}
