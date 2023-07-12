/* eslint-disable no-await-in-loop */
// eslint-disable-next-line max-classes-per-file
import { DataSource, DataSourceDecorator, RecordData } from '@forestadmin/datasource-toolkit';
import { Op, Sequelize } from 'sequelize';

import SyncCollectionDecorator from './collection';
import flattenRecord from '../../flattener';
import {
  PullDumpResponse,
  PushDeltaResponse,
  RecordDataWithCollection,
  ResolvedOptions,
  SynchronizationTarget,
} from '../../types';
import { escape, getRecordId } from '../../utils';

export default class SyncDataSourceDecorator
  extends DataSourceDecorator<SyncCollectionDecorator>
  implements SynchronizationTarget
{
  options: ResolvedOptions;

  private connection: Sequelize;

  constructor(childDataSource: DataSource, connection: Sequelize, options: ResolvedOptions) {
    super(childDataSource, SyncCollectionDecorator);

    this.connection = connection;
    this.options = options;
  }

  async applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void> {
    // Truncate tables (we should write to a temporary table and swap the tables to avoid downtime)
    if (firstPage) {
      for (const collection of this.collections) {
        await this.connection.model(collection.name).destroy({ truncate: true });
      }
    }

    const recordsByCollection = {} as Record<string, RecordData[]>;
    const entries = changes.entries.flatMap(entry => this.flattenRecord(entry));

    for (const entry of entries) {
      if (!recordsByCollection[entry.collection]) recordsByCollection[entry.collection] = [];
      recordsByCollection[entry.collection].push(entry.record);
    }

    for (const [collection, records] of Object.entries(recordsByCollection))
      await this.connection.model(collection).bulkCreate(records);
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    for (const entry of changes.deletedEntries) {
      await this.destroySubModels(entry);
      await this.connection.model(entry.collection).destroy({ where: entry.record });
    }

    // Usert records in both root and virtual collections
    for (const entry of changes.newOrUpdatedEntries) {
      await this.destroySubModels(entry);
      for (const subEntry of this.flattenRecord(entry))
        await this.connection.model(subEntry.collection).upsert(subEntry.record);
    }
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
}
