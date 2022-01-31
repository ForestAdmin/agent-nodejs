import { Action } from './action';
import Aggregation, { AggregateResultGenerator } from './query/aggregation';
import PaginatedFilter from './query/filter/paginated';
import Filter from './query/filter/unpaginated';
import Projection from './query/projection';
import { CompositeId, RecordData, RecordDataGenerator } from './record';
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

  list(filter: PaginatedFilter, projection: Projection): RecordDataGenerator;

  update(filter: Filter, patch: RecordData): Promise<void>;

  delete(filter: Filter): Promise<void>;

  aggregate(filter: PaginatedFilter, aggregation: Aggregation): AggregateResultGenerator;
}
