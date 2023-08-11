import type WriteDataSourceDecorator from './data-source';
import type { ReplicaDataSourceOptions } from '../../types';
import type { Caller, Filter, RecordData } from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  Projection,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

export default class WriteCollectionDecorator extends CollectionDecorator {
  override dataSource: WriteDataSourceDecorator;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    // we actually can't tell the db not to perform the creation...
    if (!this.options.createRecordHandler) {
      throw new UnprocessableError('This collection does not supports creations');
    }

    if (this.dataSource.options.schema.find(({ name }) => name === this.name)) {
      // I am a root collection, I can forward the creation to the target
      const promises = data.map(async record => {
        const newRecord = await this.options.createRecordHandler(this.name, record);
        Object.assign(record, newRecord ?? {});
      });

      await Promise.all(promises);
    }

    return this.childCollection.create(caller, data);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    if (!this.options.updateRecordHandler) {
      throw new UnprocessableError('This collection does not supports updates');
    }

    if (this.dataSource.options.schema.find(({ name }) => name === this.name)) {
      // I am a root collection, I can forward the update to the target
      const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
      const promises = recordsPks.map(async record => {
        Object.assign(record, patch);
        await this.options.updateRecordHandler(this.name, record);
      });

      await Promise.all(promises);
    }

    return super.update(caller, filter, patch);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    if (!this.options.deleteRecordHandler) {
      throw new UnprocessableError('This collection does not supports deletes');
    }

    if (this.dataSource.options.schema.find(({ name }) => name === this.name)) {
      // I am a root collection, I can forward the delete to the target
      const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
      const promises = recordsPks.map(async record => {
        await this.options.deleteRecordHandler(this.name, record);
      });

      await Promise.all(promises);
    }

    return super.delete(caller, filter);
  }

  private get options(): ReplicaDataSourceOptions {
    return this.dataSource.options as ReplicaDataSourceOptions;
  }
}
