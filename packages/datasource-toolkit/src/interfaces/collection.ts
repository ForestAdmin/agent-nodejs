import { ActionField, ActionResponse } from './action';
import { CollectionSchema } from './schema';
import { RecordData } from './record';
import Aggregation, { AggregateResult } from './query/aggregation';
import Filter from './query/filter/unpaginated';
import PaginatedFilter from './query/filter/paginated';
import Projection from './query/projection';

export interface DataSource {
  get collections(): Collection[];
  getCollection(name: string): Collection;
}

export interface Collection {
  get dataSource(): DataSource;
  get name(): string;
  get schema(): CollectionSchema;

  execute(name: string, formValues: RecordData, filter?: Filter): Promise<ActionResponse>;

  getForm(name: string, formValues?: RecordData, filter?: Filter): Promise<ActionField[]>;

  create(data: RecordData[]): Promise<RecordData[]>;

  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  update(filter: Filter, patch: RecordData): Promise<void>;

  delete(filter: Filter): Promise<void>;

  aggregate(filter: Filter, aggregation: Aggregation, limit?: number): Promise<AggregateResult[]>;
}
