/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';
import { TCollectionName, TRow, TSchema } from '../../../interfaces/templates';
import HookContext from './hook';

export class HookBeforeCreateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  private _data: RecordData[];

  constructor(collection: Collection, caller: Caller, data: RecordData[]) {
    super(collection, caller);

    this._data = data;
  }

  get data() {
    return this._data as unknown as TRow<S, N>[];
  }
}

export class HookAfterCreateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeCreateContext<S, N> {
  readonly records: TRow<S, N>[];

  constructor(collection: Collection, caller: Caller, data: RecordData[], records: RecordData[]) {
    super(collection, caller, data);

    this.records = records as TRow<S, N>[];
  }
}
