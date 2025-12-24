/* eslint-disable no-await-in-loop */
import type {
  PullDumpResponse,
  PushDeltaResponse,
  RecordDataWithCollection,
  ResolvedOptions,
  SynchronizationTarget,
} from '../types';
import type { Logger, RecordData } from '@forestadmin/datasource-toolkit';
import type { Sequelize, Transaction } from 'sequelize';

import { Op } from 'sequelize';

import flattenRecord from '../flattener';
import { escape, getRecordId } from '../utils';

export default class CacheTarget implements SynchronizationTarget {
  connection: Sequelize;
  options: ResolvedOptions;
  logger: Logger;

  constructor(connection: Sequelize, options: ResolvedOptions, logger: Logger) {
    this.connection = connection;
    this.options = options;
    this.logger = logger;
  }

  async applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void> {
    if (firstPage) {
      // Truncate tables
      for (const collection of this.options.flattenSchema) {
        await this.connection.model(collection.name).truncate();
      }
    }

    const recordsByCollection = {} as Record<string, RecordData[]>;
    const entries = changes.entries.flatMap(entry => this.flattenRecord(entry));

    for (const entry of entries) {
      if (entry !== undefined) {
        if (!recordsByCollection[entry.collection]) recordsByCollection[entry.collection] = [];
        recordsByCollection[entry.collection].push(entry.record);
      }
    }

    await this.connection.transaction(async transaction => {
      for (const [collection, records] of Object.entries(recordsByCollection)) {
        await this.connection.model(collection).bulkCreate(records, { transaction });
      }
    });
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    await this.connection.transaction(async transaction => {
      for (const entry of changes.deletedEntries) {
        if (this.checkCollection(entry.collection)) {
          await this.destroySubModels(entry, transaction);
          await this.connection
            .model(entry.collection)
            .destroy({ where: entry.record, transaction });
        }
      }

      // Upsert records in both root and virtual collections

      for (const entry of changes.newOrUpdatedEntries) {
        if (this.checkCollection(entry.collection)) {
          await this.destroySubModels(entry, transaction);

          for (const subEntry of this.flattenRecord(entry)) {
            await this.connection
              .model(subEntry.collection)
              .upsert(subEntry.record, { transaction });
          }
        }
      }
    });
  }

  private flattenRecord(
    recordWithCollection: RecordDataWithCollection,
  ): RecordDataWithCollection[] {
    if (this.checkCollection(recordWithCollection.collection)) {
      return flattenRecord(
        recordWithCollection,
        this.options.schema.find(s => s.name === recordWithCollection.collection).fields,
        this.options?.flattenOptions?.[recordWithCollection.collection]?.asFields ?? [],
        this.options?.flattenOptions?.[recordWithCollection.collection]?.asModels ?? [],
      );
    }
  }

  private async destroySubModels(
    entry: RecordDataWithCollection,
    transaction?: Transaction,
  ): Promise<void> {
    const { asModels } = this.options.flattenOptions[entry.collection];
    const { fields } = this.options.schema.find(c => c.name === entry.collection);
    const promises = asModels.map(asModel => {
      const recordId = getRecordId(fields, entry.record);

      return this.connection.model(escape`${entry.collection}.${asModel}`).destroy({
        where: { _fid: { [Op.startsWith]: `${recordId}.${asModel}` } },
        transaction,
      });
    });

    await Promise.all(promises);
  }

  private checkCollection(collection: string): boolean {
    const collectionName = this.options.schema.find(s => s.name === collection);

    if (!collectionName) {
      this.logger('Error', `Collection '${collection}' not found in schema. Skipping.`);

      return false;
    }

    return true;
  }
}
