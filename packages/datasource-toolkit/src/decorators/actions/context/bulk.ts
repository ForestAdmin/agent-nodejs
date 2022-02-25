import { Collection } from '../../../interfaces/collection';
import { CompositeId, RecordData } from '../../../interfaces/record';
import { RecordUtils } from '../../..';
import ActionContext from './base';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';

export default class ActionContextBulk extends ActionContext {
  readonly filter: Filter;

  constructor(collection: Collection, formValues: RecordData, used: Set<string>, filter: Filter) {
    super(collection, formValues, used);
    this.filter = filter;
  }

  async getRecordIds(): Promise<CompositeId[]> {
    if (this.filter === null) {
      throw new Error('Form was marked as static');
    }

    const records = await this.getRecords(new Projection().withPks(this.collection));

    return records.map(r => RecordUtils.getPrimaryKey(this.collection.schema, r));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRecords(projection: string[]): Promise<any[]> {
    if (this.filter === null) {
      throw new Error('Form was marked as static');
    }

    return this.collection.list(this.filter, new Projection(...projection));
  }
}
