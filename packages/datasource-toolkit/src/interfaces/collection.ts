import { ActionField, ActionResult } from './action';
import { Caller } from './caller';
import { CollectionSchema } from './schema';
import { RecordData } from './record';
import Aggregation, { AggregateResult } from './query/aggregation';
import Filter from './query/filter/unpaginated';
import PaginatedFilter from './query/filter/paginated';
import Projection from './query/projection';

export interface DataSource {
  get collections(): Collection[];
  getCollection(name: string): Collection;
  addCollection(collection: Collection): void;
}

export interface Collection {
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
}
