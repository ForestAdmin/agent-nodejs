import { Action } from './action';
import { AggregateResult, Aggregation } from './query/aggregation';
import { Projection } from './query/projection';
import { CompositeId, RecordData } from './query/record';
import { PaginatedFilter, Filter } from './query/selection';
import { CollectionSchema } from './schema';

export interface DataSource {
  get collections(): Collection[];
  getCollection(name: string): Collection;
}

export interface Collection {
  get dataSource(): DataSource;
  get name(): string;
  get schema(): CollectionSchema;

  getAction(name: string): Action;

  getById(id: CompositeId, projection: Projection): Promise<RecordData>;

  create(data: RecordData[]): Promise<RecordData[]>;

  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  update(filter: Filter, patch: RecordData): Promise<void>;

  delete(filter: Filter): Promise<void>;

  aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]>;
}
