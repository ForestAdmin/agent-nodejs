import type { TCollectionName, TFieldName, TFieldType, TRow, TSchema } from '../../../templates';
import type { CompositeId } from '@forestadmin/datasource-toolkit';

import ActionContext from './base';

export default class ActionContextSingle<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends ActionContext<S, N> {
  async getRecordId(): Promise<string | number> {
    const compositeId = await this.getCompositeRecordId();
    this.assertSomeRecordsMatch(compositeId);

    return compositeId[0];
  }

  async getCompositeRecordId(): Promise<CompositeId> {
    const ids = await this.getCompositeRecordIds();
    this.assertSomeRecordsMatch(ids);

    return ids[0];
  }

  async getRecord(fields: TFieldName<S, N>[]): Promise<TRow<S, N>> {
    const records = await this.getRecords(fields);
    this.assertSomeRecordsMatch(records);

    return records[0];
  }

  async getField<T extends TFieldName<S, N>>(field: T): Promise<TFieldType<S, N, T>> {
    let value = await this.getRecord([field]);

    for (const path of field.split(':')) {
      value = value?.[path];
    }

    return value as TFieldType<S, N, T>;
  }
}
