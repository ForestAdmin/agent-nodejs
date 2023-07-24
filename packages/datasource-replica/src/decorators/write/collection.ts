import {
  Caller,
  CollectionDecorator,
  Filter,
  Projection,
  RecordData,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import WriteDataSourceDecorator from './data-source';
import { ReplicaDataSourceOptions } from '../../types';

export default class WriteCollectionDecorator extends CollectionDecorator {
  override dataSource: WriteDataSourceDecorator;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    // we actually can't tell the db not to perform the creation...
    if (!this.options.createRecord) {
      throw new UnprocessableError('This collection does not supports creations');
    }

    if (this.dataSource.options.schema[this.name]) {
      // I am a root collection, I can forward the creation to the target
      const promises = data.map(async record => {
        const newRecord = await this.options.createRecord(this.name, record);
        Object.assign(record, newRecord ?? {});
      });

      await Promise.all(promises);
    } else {
      // I am a child collection, I need to transform this creation into an update
    }

    return this.childCollection.create(caller, data);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    if (!this.options.updateRecord) {
      throw new UnprocessableError('This collection does not supports updates');
    }

    if (this.dataSource.options.schema[this.name]) {
      // I am a root collection, I can forward the update to the target
      const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
      const promises = recordsPks.map(async record => {
        Object.assign(record, patch);
        await this.options.updateRecord(this.name, record);
      });

      await Promise.all(promises);
    } else {
      // I am a child collection, I need to send whole records to the target
    }

    return super.update(caller, filter, patch);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    if (!this.options.deleteRecord) {
      throw new UnprocessableError('This collection does not supports updates');
    }

    if (this.dataSource.options.schema[this.name]) {
      // I am a root collection, I can forward the delete to the target
      const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
      const promises = recordsPks.map(async record => {
        await this.options.deleteRecord(this.name, record);
      });

      await Promise.all(promises);
    } else {
      // I am a child collection, I need to send whole records to the target
    }

    return super.delete(caller, filter);
  }

  private get options(): ReplicaDataSourceOptions {
    return this.dataSource.options as ReplicaDataSourceOptions;
  }
}
