import { ActionField, ActionResult } from './action';
import { CollectionSchema } from './schema';
import { QueryRecipient } from './user';
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
    recipient: QueryRecipient,
    name: string,
    formValues: RecordData,
    filter?: Filter,
  ): Promise<ActionResult>;

  getForm(
    recipient: QueryRecipient,
    name: string,
    formValues?: RecordData,
    filter?: Filter,
  ): Promise<ActionField[]>;

  create(recipient: QueryRecipient, data: RecordData[]): Promise<RecordData[]>;

  list(
    recipient: QueryRecipient,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]>;

  update(recipient: QueryRecipient, filter: Filter, patch: RecordData): Promise<void>;

  delete(recipient: QueryRecipient, filter: Filter): Promise<void>;

  aggregate(
    recipient: QueryRecipient,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]>;
}
