import type { SequelizeExt } from './type-overrides';
import type { SequelizeDatasourceOptions } from './types';
import type { DataSourceDatabase, DataSourceSchema, Logger } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import { BaseDataSource, makeDatabaseEntry } from '@forestadmin/datasource-toolkit';
import { win32 } from 'path';
import { QueryTypes } from 'sequelize';

import SequelizeCollection from './collection';

interface NativeQueryConnection {
  instance: Sequelize;
}

const EPHEMERAL_SQLITE_STORAGES = [':memory:', ''];
const DATABASE_DIALECTS = new Set(['postgres', 'mysql', 'mariadb', 'mssql', 'sqlite', 'oracle']);
const ORACLE_CONNECT_DESCRIPTOR = /[:/()]/;
const DIALECTS_READING_DATABASE_FROM_DIALECT_OPTIONS = new Set([
  'mysql',
  'mariadb',
  'snowflake',
  'db2',
]);

function isEphemeralSqlite(instance: Sequelize): boolean {
  const { storage, host } = (instance as SequelizeExt).options;

  return (
    instance.getDialect() === 'sqlite' &&
    EPHEMERAL_SQLITE_STORAGES.includes(storage ?? (host || ':memory:'))
  );
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

function describeDatabase(instance: Sequelize): DataSourceDatabase {
  const dialect = instance.getDialect();

  if (dialect === 'sqlite') {
    const { storage, host } = (instance as SequelizeExt).options;
    const file = isEphemeralSqlite(instance) ? null : storage ?? host;

    return makeDatabaseEntry('sqlite', file && win32.basename(file));
  }

  const name = resolveDatabaseName(instance);

  if (dialect === 'oracle' && !isPlainOracleName(instance, name)) {
    return makeDatabaseEntry('oracle', null);
  }

  return makeDatabaseEntry(DATABASE_DIALECTS.has(dialect) ? dialect : 'other', name);
}

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  /**
   * We can't directly use the Sequelize version we install in the package.json
   * as the customer's version may be different.
   * To ensure compatibility, we need to only import types from Sequelize,
   *    and use the customer sequelize version to deal with the data manipulation.
   */
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize, logger?: Logger, options?: SequelizeDatasourceOptions) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');
    if (!sequelize.models) throw new Error('Invalid (null) Sequelize models.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models, logger);

    if (options?.liveQueryConnections) {
      this.addNativeQueryConnection(options.liveQueryConnections, { instance: this.sequelize });
    }
  }

  async close(): Promise<void> {
    await this.sequelize.close();
  }

  override get schema(): DataSourceSchema {
    return { ...super.schema, databases: [describeDatabase(this.sequelize)] };
  }

  protected createCollections(models: Sequelize['models'], logger?: Logger) {
    Object.values(models)
      // avoid schema reordering
      .sort((modelA, modelB) => (modelA.name > modelB.name ? 1 : -1))
      .forEach(model => {
        const collection = new SequelizeCollection(model.name, this, model, logger);
        this.addCollection(collection);
      });
  }

  override async executeNativeQuery<R extends object>(
    connectionName: string,
    query: string,
    contextVariables = {},
  ): Promise<R[]> {
    if (!this.nativeQueryConnections[connectionName]) {
      throw new Error(`Unknown connection name '${connectionName}'`);
    }

    const { instance } = this.nativeQueryConnections[connectionName] as NativeQueryConnection;
    const selectOptions = { bind: contextVariables, type: QueryTypes.SELECT, raw: true } as const;

    // A transaction cannot isolate an ephemeral SQLite database: in memory, Sequelize runs every
    // query on one connection, so its rollback would undo other requests' writes; on an empty
    // storage, each connection opens its own private database, where the tables do not exist.
    if (isEphemeralSqlite(instance)) return instance.query<R>(query, selectOptions);

    // Live queries only read: whatever their text runs, it is rolled back, never committed.
    const transaction = await instance.transaction({ readOnly: true });
    let rows: R[];

    try {
      if (instance.getDialect() === 'postgres') {
        await instance.query('SET TRANSACTION READ ONLY', { transaction });
      }

      rows = await instance.query<R>(query, { ...selectOptions, transaction });
    } catch (error) {
      // The failed query may have ended the transaction already; its error is the one to report.
      await transaction.rollback().catch(() => undefined);
      throw error;
    }

    await transaction.rollback();

    return rows;
  }
}
