import { CompositeId } from '../../../interfaces/record';
import ActionContext from './base';
import Projection from '../../../interfaces/query/projection';
import RecordUtils from '../../../utils/record';

export default class ActionContextSingle extends ActionContext {
  async getRecordId(): Promise<CompositeId> {
    const projection = new Projection().withPks(this.collection.rawCollection);
    const records = await this.getRecords(projection);

    return RecordUtils.getPrimaryKey(this.collection.schema, records[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRecord(fields: string[]): Promise<any> {
    const records = await this.getRecords(fields);

    return records[0];
  }
}
