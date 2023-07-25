/* eslint-disable no-await-in-loop */
import type {
  PullDumpResponse,
  PushDeltaResponse,
  RecordDataWithCollection,
  ResolvedOptions,
  SynchronizationTarget,
} from '../types';
import type { RecordData } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import { Op } from 'sequelize';

import flattenRecord from '../flattener';
import { escape, getRecordId } from '../utils';

export default class CacheTarget implements SynchronizationTarget {
  connection: Sequelize;
  options: ResolvedOptions;

  constructor(connection: Sequelize, options: ResolvedOptions) {
    this.connection = connection;
    this.options = options;
  }

  async applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void> {
    // fixme use something so that final users see the whole dump as a single transaction
    // [transaction / temporary table]

    await this.connection.transaction(async transaction => {
      if (firstPage) {
        // Truncate tables
        for (const collection of this.options.flattenSchema) {
          await this.connection.model(collection.name).truncate({ transaction });
        }
      }

      const recordsByCollection = {} as Record<string, RecordData[]>;
      const entries = changes.entries.flatMap(entry => this.flattenRecord(entry));

      for (const entry of entries) {
        if (!recordsByCollection[entry.collection]) recordsByCollection[entry.collection] = [];
        recordsByCollection[entry.collection].push(entry.record);
      }

      for (const [collection, records] of Object.entries(recordsByCollection)) {
        this.checkCollection(collection);

        // fixme check that no pre-processing of the records are needed to handle
        // dates, buffers, ...
        await this.connection.model(collection).bulkCreate(records, { transaction });
      }
    });
    // [/transaction / temporary table]
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    // fixme use a transaction to wrap the whole thing
    // [transaction]

    for (const entry of changes.deletedEntries) {
      this.checkCollection(entry.collection);
      await this.destroySubModels(entry);
      await this.connection.model(entry.collection).destroy({ where: entry.record });
    }

    // Upsert records in both root and virtual collections
    for (const entry of changes.newOrUpdatedEntries) {
      this.checkCollection(entry.collection);
      await this.destroySubModels(entry);

      // fixme check that no pre-processing of the records are needed to handle
      // dates, buffers, ...
      for (const subEntry of this.flattenRecord(entry))
        await this.connection.model(subEntry.collection).upsert(subEntry.record);
    }

    // [/transaction]
  }

  private flattenRecord(
    recordWithCollection: RecordDataWithCollection,
  ): RecordDataWithCollection[] {
    return flattenRecord(
      recordWithCollection,
      this.options.schema.find(s => s.name === recordWithCollection.collection).fields,
      this.options?.flattenOptions?.[recordWithCollection.collection]?.asFields ?? [],
      this.options?.flattenOptions?.[recordWithCollection.collection]?.asModels ?? [],
    );
  }

  private async destroySubModels(entry: RecordDataWithCollection): Promise<void> {
    const { asModels } = this.options.flattenOptions[entry.collection];
    const { fields } = this.options.schema.find(c => c.name === entry.collection);
    const promises = asModels.map(asModel => {
      const recordId = getRecordId(fields, entry.record);

      return this.connection.model(escape`${entry.collection}.${asModel}`).destroy({
        where: { _fid: { [Op.startsWith]: `${recordId}.${asModel}` } },
      });
    });

    await Promise.all(promises);
  }

  private checkCollection(collection: string): void {
    if (!this.options.schema.find(s => s.name === collection))
      throw new Error(`Collection ${collection} not found in schema`);
  }
}
