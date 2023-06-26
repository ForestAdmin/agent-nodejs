import {
  Caller,
  CollectionDecorator,
  Filter,
  Projection,
  RecordData,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import WriteDataSourceDecorator from './data-source';
import { CachedDataSourceOptions } from '../../types';

export default class WriteCollectionDecorator extends CollectionDecorator {
  override dataSource: WriteDataSourceDecorator;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    // we actually can't tell the db not to perform the creation...
    if (!this.options.createRecord) {
      throw new UnprocessableError('This collection does not supports creations');
    }

    const promises = data.map(async record => {
      const newRecord = await this.options.createRecord(this.shortName, record);
      Object.assign(record, newRecord);
    });

    await Promise.all(promises);

    return this.childCollection.create(caller, data);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    if (!this.options.updateRecord) {
      throw new UnprocessableError('This collection does not supports updates');
    }

    const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
    const promises = recordsPks.map(async record => {
      Object.assign(record, patch);
      await this.options.updateRecord(this.shortName, record);
    });

    await Promise.all(promises);

    return super.update(caller, filter, patch);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    if (!this.options.deleteRecord) {
      throw new UnprocessableError('This collection does not supports updates');
    }

    const recordsPks = await super.list(caller, filter, new Projection().withPks(this));
    const promises = recordsPks.map(async record => {
      await this.options.deleteRecord(this.shortName, record);
    });

    await Promise.all(promises);

    return super.delete(caller, filter);
  }

  private get options(): CachedDataSourceOptions {
    return this.dataSource.options as CachedDataSourceOptions;
  }

  protected get shortName(): string {
    return this.name.substring(this.options.namespace.length + 1);
  }
}
