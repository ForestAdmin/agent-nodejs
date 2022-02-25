import { Collection } from '../../../interfaces/collection';
import { CompositeId, RecordData } from '../../../interfaces/record';
import ActionContext from './base';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';
import RecordUtils from '../../../utils/record';

export default class ActionContextSingle extends ActionContext {
  readonly filter: Filter;

  constructor(collection: Collection, formValues: RecordData, used: Set<string>, filter: Filter) {
    super(collection, formValues, used);
    this.filter = filter;
  }

  async getRecordId(): Promise<CompositeId> {
    const record = await this.getRecord(new Projection().withPks(this.collection));

    return RecordUtils.getPrimaryKey(this.collection.schema, record);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRecord(projection: string[]): Promise<any> {
    const [record] = await this.collection.list(this.filter, new Projection(...projection));

    return record;
  }
}
