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

function resolveDatabaseName(instance: Sequelize): string {
  const { database, dialectOptions, replication } = instance.config;
  const dialect = instance.getDialect();
  const driverOptions = dialectOptions as
    | { database?: string; options?: { database?: string } }
    | undefined;

  if (
    DIALECTS_READING_DATABASE_FROM_DIALECT_OPTIONS.has(dialect) &&
    driverOptions?.database !== undefined
  ) {
    return driverOptions.database;
  }

  if (dialect === 'mssql' && driverOptions?.options?.database !== undefined) {
    return driverOptions.options.database;
  }

  if (replication && replication.write?.database !== undefined) {
    return replication.write.database;
  }

  return database;
}

function isPlainOracleName(instance: Sequelize, name: string): boolean {
  const { connectString } =
    (instance.config.dialectOptions as { connectString?: string } | undefined) ?? {};

  return connectString === undefined && name !== null && !ORACLE_CONNECT_DESCRIPTOR.test(name);
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
