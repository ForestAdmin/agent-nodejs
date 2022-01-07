import { Action } from './interfaces/action';
import { Collection, DataSource } from './interfaces/collection';
import { AggregateResult, Aggregation } from './interfaces/query/aggregation';
import { Projection } from './interfaces/query/projection';
import { CompositeId, RecordData } from './interfaces/query/record';
import { Filter, PaginatedFilter } from './interfaces/query/selection';
import { ActionSchema, CollectionSchema } from './interfaces/schema';

export default abstract class BaseCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name = null;
  readonly schema: CollectionSchema = null;

  constructor(name, datasource: DataSource, schema: CollectionSchema) {
    this.dataSource = datasource;
    this.name = name;
    this.schema = schema;
  }

  getAction(name: string): Action {
    const actionSchema = this.schema.actions[name];

    if (actionSchema === undefined) throw new Error(`Action "${name}" not found.`);

    return new (actionSchema.actionClass as new () => Action)();
  }

  addAction(name: string, action: ActionSchema): void {
    const actionSchema = this.schema.actions[name];

    if (actionSchema) throw new Error(`Action "${name}" already defined in collection`);

    this.schema.actions[name] = action;
  }

  abstract getById(id: CompositeId, projection: Projection): Promise<RecordData>;

  abstract create(data: RecordData[]): Promise<RecordData[]>;

  abstract list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  abstract update(filter: Filter, patch: RecordData): Promise<void>;

  abstract delete(filter: Filter): Promise<void>;

  abstract aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]>;
}
