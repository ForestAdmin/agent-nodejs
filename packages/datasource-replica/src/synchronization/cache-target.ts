/* eslint-disable no-await-in-loop */
import type {
  PullDumpResponse,
  PushDeltaResponse,
  RecordDataWithCollection,
  ResolvedOptions,
  SynchronizationTarget,
} from '../types';
import type { Logger, RecordData } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

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
    // fixme use something so that final users see the whole dump as a single transaction
    // [transaction / temporary table]

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

    for (const [collection, records] of Object.entries(recordsByCollection)) {
      // fixme check that no pre-processing of the records are needed to handle
      // dates, buffers, ...
      await this.connection.model(collection).bulkCreate(records);
    }
    // [/transaction / temporary table]
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    // fixme use a transaction to wrap the whole thing
    // [transaction]

    for (const entry of changes.deletedEntries) {
      if (
        this.checkCollectionAndFieldsInSchema(entry.collection, Object.keys(entry.record), false)
      ) {
        await this.destroySubModels(entry);
        await this.connection.model(entry.collection).destroy({ where: entry.record });
      }
    }

    // Upsert records in both root and virtual collections

    for (const entry of changes.newOrUpdatedEntries) {
      if (
        this.checkCollectionAndFieldsInSchema(entry.collection, Object.keys(entry.record), false)
      ) {
        await this.destroySubModels(entry);

        // fixme check that no pre-processing of the records are needed to handle
        // dates, buffers, ...
        for (const subEntry of this.flattenRecord(entry))
          await this.connection.model(subEntry.collection).upsert(subEntry.record);
      }
    }

    // [/transaction]
  }

  private flattenRecord(
    recordWithCollection: RecordDataWithCollection,
  ): RecordDataWithCollection[] {
    if (
      this.checkCollectionAndFieldsInSchema(
        recordWithCollection.collection,
        Object.keys(recordWithCollection.record),
        false,
      )
    )
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

  private checkCollection(collection: string, shouldTrow: boolean): void {
    if (!this.options.schema.find(s => s.name === collection))
      if (shouldTrow) {
        throw new Error(`Collection ${collection} not found in schema`);
      } else {
        this.logger('Error', `Collection ${collection} not found in schema`);
      }
  }

  private checkCollectionAndFieldsInSchema(
    collection: string,
    fields: string[],
    shouldThrow: boolean,
  ): boolean {
    const schemaEntry = this.options.schema.find(s => s.name === collection);

    if (!schemaEntry) {
      if (shouldThrow) {
        throw new Error(`Collection ${collection} not found in schema`);
      } else {
        this.logger('Error', `Collection '${collection}' not found in schema`);
      }

      return false;
    }

    const schemaFields = Object.keys(schemaEntry.fields);

    const missingFields = fields.filter(field => !schemaFields.includes(field));

    if (fields.length - missingFields.length <= 0) {
      this.logger(
        'Error',
        // eslint-disable-next-line max-len
        `Cannot find any field in the given records matching the schema of collection "${collection}"`,
      );

      return false;
    }

    if (missingFields.length > 0) {
      const errorMessage = `Fields '${missingFields.join(
        ', ',
      )}' do not exist in the schema for collection ${collection}`;

      if (shouldThrow) {
        throw new Error(errorMessage);
      } else {
        this.logger('Warn', errorMessage);
      }
    }

    return true;
  }
}
