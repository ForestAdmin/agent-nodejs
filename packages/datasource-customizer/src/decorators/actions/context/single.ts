import { CompositeId } from '@forestadmin/datasource-toolkit';

import ActionContext from './base';
import { TCollectionName, TFieldName, TFieldType, TRow, TSchema } from '../../../templates';

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

  async getField<T extends TFieldName<S, N>>(field: T): Promise<TFieldType<S, N, T>> {
    let value = await this.getRecord([field]);

    for (const path of field.split(':')) {
      value = value?.[path];
    }

    return value as TFieldType<S, N, T>;
  }
}
