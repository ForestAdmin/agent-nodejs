import { Collection } from '../../../interfaces/collection';
import { CompositeId, RecordData } from '../../../interfaces/record';
import { RecordUtils } from '../../..';
import ActionContext from './base';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';

export default class ActionContextBulk extends ActionContext {
  protected readonly filter: Filter;
  private dependencies: Projection;
  private recordIds: CompositeId[];
  private records: RecordData[];

  constructor(
    collection: Collection,
    formValues: RecordData,
    used: Set<string>,
    dependencies: Projection,
    filter: Filter,
  ) {
    super(collection, formValues, used);

    this.dependencies = dependencies;
    this.filter = filter;
  }

  async getRecordIds(): Promise<CompositeId[]> {
    if (this.filter === null) {
      throw new Error('Form was marked as static');
    }

    if (!this.recordIds) {
      const records = await this.collection.list(
        this.filter,
        new Projection().withPks(this.collection),
      );

      this.recordIds = records.map(r => RecordUtils.getPrimaryKey(this.collection.schema, r));
    }

    return this.recordIds;
  }

  async getRecords(): Promise<RecordData[]> {
    if (this.filter === null) {
      throw new Error('Form was marked as static');
    }

    if (!this.records) {
      this.records = await this.collection.list(this.filter, this.dependencies);
    }

    return this.records;
  }
}
