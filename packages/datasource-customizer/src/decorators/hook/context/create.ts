/* eslint-disable max-classes-per-file */

import { Caller, Collection, RecordData } from '@forestadmin/datasource-toolkit';
import { TCollectionName, TRow, TSchema } from '../../../templates';
import HookContext from './hook';

export class HookBeforeCreateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _data: RecordData[];

  constructor(collection: Collection, caller: Caller, data: RecordData[]) {
    super(collection, caller);

    this._data = data;
  }

  get data() {
    return Object.freeze(this._data as unknown as TRow<S, N>[]);
  }
}

export class InternalHookBeforeCreateContext extends HookBeforeCreateContext {
  getData(): RecordData[] {
    return this._data;
  }
}

export class HookAfterCreateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeCreateContext<S, N> {
  private _records: TRow<S, N>[];

  constructor(collection: Collection, caller: Caller, data: RecordData[], records: RecordData[]) {
    super(collection, caller, data);

    this._records = records as TRow<S, N>[];
  }

  get records() {
    return Object.freeze(this._records);
  }
}
