import { CompositeId } from '../../../interfaces/record';
import ActionContext from './base';
import Projection from '../../../interfaces/query/projection';
import RecordUtils from '../../../utils/record';

export default class ActionContextSingle extends ActionContext {
  async getRecordId(): Promise<string | number> {
    const compositeId = await this.getCompositeRecordId();

    return compositeId[0];
  }

  async getCompositeRecordId(): Promise<CompositeId> {
    const projection = new Projection().withPks(this.realCollection);
    const records = await this.getRecords(projection);

    return RecordUtils.getPrimaryKey(this.realCollection.schema, records[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRecord(fields: string[]): Promise<any> {
    const records = await this.getRecords(fields);

    return records[0];
  }
}
