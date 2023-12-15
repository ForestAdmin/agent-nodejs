import { ActionField, ActionResult } from './action';
import { Caller } from './caller';
import { Chart } from './chart';
import Aggregation, { AggregateResult } from './query/aggregation';
import PaginatedFilter from './query/filter/paginated';
import Filter from './query/filter/unpaginated';
import Projection from './query/projection';
import { CompositeId, RecordData } from './record';
import { CollectionSchema, DataSourceSchema } from './schema';

export interface DataSource<C extends Collection = Collection> {
  get collections(): C[];
  get schema(): DataSourceSchema;

  getCollection(name: string): C;

  renderChart(caller: Caller, name: string): Promise<Chart>;
}

export type GetFormMetas = {
  changedField?: string;
  searchField?: string | null;
  searchValues?: Record<string, string | null>;
  includeHiddenFields?: boolean;
};

export interface Collection {
  get nativeDriver(): unknown | null;
  get dataSource(): DataSource;
  get name(): string;
  get schema(): CollectionSchema;

  execute(
    caller: Caller,
    name: string,
    formValues: RecordData,
    filter?: Filter,
  ): Promise<ActionResult>;

  getForm(
    caller: Caller,
    name: string,
    formValues?: RecordData,
    filter?: Filter,
    metas?: GetFormMetas,
  ): Promise<ActionField[]>;

  create(caller: Caller, data: RecordData[]): Promise<RecordData[]>;

  list(caller: Caller, filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  update(caller: Caller, filter: Filter, patch: RecordData): Promise<void>;

  delete(caller: Caller, filter: Filter): Promise<void>;

  aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]>;

  renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart>;
}
