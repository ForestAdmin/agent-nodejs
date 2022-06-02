/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { PlainConditionTree } from '../../../interfaces/query/condition-tree/nodes/base';
import { RecordData } from '../../../interfaces/record';
import { TCollectionName, TFieldName, TRow, TSchema } from '../../../interfaces/templates';
import ConditionTreeFactory from '../../../interfaces/query/condition-tree/factory';
import HookContext from './hook';
import PaginatedFilter, { PlainPaginatedFilter } from '../../../interfaces/query/filter/paginated';
import Projection from '../../../interfaces/query/projection';

export class HookBeforeListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _filter: PaginatedFilter;
  protected _projection: Projection;

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ) {
    super(collection, caller);

    this._filter = filter;
    this._projection = projection;
  }

  get filter() {
    return this._filter as unknown as PlainPaginatedFilter<S, N>;
  }

  get projection() {
    return this._projection as unknown as TFieldName<S, N>[];
  }

  addFieldToProjection(field: TFieldName<S, N>) {
    this._projection.push(field);
  }

  addFilteringCondition(plainConditionTree: PlainConditionTree<S, N>) {
    const conditionTree = ConditionTreeFactory.fromPlainObject(plainConditionTree);
    this._filter.conditionTree = ConditionTreeFactory.intersect(
      conditionTree,
      this._filter.conditionTree,
    );
  }
}

export class InternalHookBeforeListContext extends HookBeforeListContext {
  getFilter(): PaginatedFilter {
    return this._filter;
  }

  getProjection(): Projection {
    return this._projection;
  }
}

export class HookAfterListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeListContext<S, N> {
  readonly records: TRow<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
    records: RecordData[],
  ) {
    super(collection, caller, filter, projection);

    this.records = records as TRow<S, N>[];
  }
}
