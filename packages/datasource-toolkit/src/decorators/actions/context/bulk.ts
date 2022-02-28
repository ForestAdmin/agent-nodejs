import { CompositeId } from '../../../interfaces/record';
import { Filter, RecordUtils } from '../../..';
import ActionContext from './base';
import Projection from '../../../interfaces/query/projection';

export default class ActionContextBulk extends ActionContext {
  override filter: Filter; // make filter public

  async getRecordIds(): Promise<CompositeId[]> {
    const projection = new Projection().withPks(this.collection);
    const records = await this.getRecords(projection);

    return records.map(r => RecordUtils.getPrimaryKey(this.collection.schema, r));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async getRecords(fields: string[]): Promise<any[]> {
    return super.getRecords(fields);
  }
}
