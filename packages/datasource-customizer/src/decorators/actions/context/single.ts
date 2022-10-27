import { CompositeId } from '@forestadmin/datasource-toolkit';

import { TCollectionName, TFieldName, TRow, TSchema } from '../../../templates';
import ActionContext from './base';

export default class ActionContextSingle<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends ActionContext<S, N> {
  async getRecordId(): Promise<string | number> {
    const compositeId = await this.getCompositeRecordId();

    return compositeId[0];
  }

  async getCompositeRecordId(): Promise<CompositeId> {
    const ids = await this.getCompositeRecordIds();

    return ids[0];
  }

  async getRecord(fields: TFieldName<S, N>[]): Promise<TRow<S, N>> {
    const records = await this.getRecords(fields);

    return records[0];
  }
}
