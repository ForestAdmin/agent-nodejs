/**
 * Interpret the Sequelize connection config into one `schema.databases` entry: dialect type
 * and database name, mirroring the parameters each dialect's connection manager connects
 * with, and never reporting a connect target (host, descriptor, URI) as a database name.
 */

import type { SequelizeExt } from '../type-overrides';
import type { DataSourceDatabase } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import { makeDatabaseEntry } from '@forestadmin/datasource-toolkit';
import { win32 } from 'path';

const EPHEMERAL_SQLITE_STORAGES = [':memory:', ''];
const DATABASE_DIALECTS = new Set(['postgres', 'mysql', 'mariadb', 'mssql', 'sqlite', 'oracle']);
const ORACLE_CONNECT_DESCRIPTOR = /[:/()]/;
const DIALECTS_READING_DATABASE_FROM_DIALECT_OPTIONS = new Set([
  'mysql',
  'mariadb',
  'snowflake',
  'db2',
]);

/** The sqlite file Sequelize would open, or null when the database is ephemeral. */
function sqliteStorageFile(instance: Sequelize): string | null {
  const { storage, host } = (instance as SequelizeExt).options;
  const file = storage ?? host;

  return file && !EPHEMERAL_SQLITE_STORAGES.includes(file) ? file : null;
}

export function isEphemeralSqlite(instance: Sequelize): boolean {
  return instance.getDialect() === 'sqlite' && sqliteStorageFile(instance) === null;
}

/** The connection parameters a query against the write pool runs with. */
interface EffectiveConnectionConfig {
  database?: string | null;
  host?: string | null;
  dialectOptions?: {
    database?: string;
    options?: { database?: string };
    connectString?: string;
  };
  replication?: false | { write?: EffectiveConnectionConfig };
}

/** `_.defaults` semantics: only an undefined value falls back to the global config. */
function withGlobalDefault<T>(value: T | undefined, globalValue: T | undefined): T | undefined {
  return value === undefined ? globalValue : value;
}

/**
 * The write pool connects with `replication.write`, where Sequelize fills every unset key
 * from the global config (`initPools` defaults that merge on a clone of the config, so it
 * is rebuilt here); without replication, the global config is what the pool uses.
 */
function effectiveConnectionConfig(instance: Sequelize): EffectiveConnectionConfig {
  const globalConfig = instance.config as EffectiveConnectionConfig;
  const write = globalConfig.replication && globalConfig.replication.write;

  if (!write) return globalConfig;

  return {
    database: withGlobalDefault(write.database, globalConfig.database),
    host: withGlobalDefault(write.host, globalConfig.host),
    dialectOptions: withGlobalDefault(write.dialectOptions, globalConfig.dialectOptions),
  };
}

function resolveDatabaseName(instance: Sequelize): string | null {
  const config = effectiveConnectionConfig(instance);
  const dialect = instance.getDialect();
  const driverOptions = config.dialectOptions;

  if (
    DIALECTS_READING_DATABASE_FROM_DIALECT_OPTIONS.has(dialect) &&
    driverOptions?.database !== undefined
  ) {
    return driverOptions.database;
  }

  if (dialect === 'mssql' && driverOptions?.options?.database !== undefined) {
    return driverOptions.options.database;
  }

  return config.database ?? null;
}

/** An explicit descriptor or connect string holds a connect target, not a database name. */
function isPlainOracleName(instance: Sequelize, name: string | null): boolean {
  const config = effectiveConnectionConfig(instance);

  return (
    config.dialectOptions?.connectString === undefined &&
    name !== null &&
    !ORACLE_CONNECT_DESCRIPTOR.test(name)
  );
}

export function describeDatabase(instance: Sequelize): DataSourceDatabase {
  const dialect = instance.getDialect();

  if (dialect === 'sqlite') {
    const file = sqliteStorageFile(instance);

    return makeDatabaseEntry('sqlite', file ? win32.basename(file) : null);
  }

  const name = resolveDatabaseName(instance);

  if (dialect === 'oracle' && !isPlainOracleName(instance, name)) {
    return makeDatabaseEntry('oracle', null);
  }

  return makeDatabaseEntry(DATABASE_DIALECTS.has(dialect) ? dialect : 'other', name);
}
