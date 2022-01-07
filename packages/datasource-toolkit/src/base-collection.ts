import { Action } from './interfaces/action';
import { Collection, DataSource } from './interfaces/collection';
import { AggregateResult, Aggregation } from './interfaces/query/aggregation';
import { Projection } from './interfaces/query/projection';
import { CompositeId, RecordData } from './interfaces/query/record';
import { Filter, PaginatedFilter } from './interfaces/query/selection';
import { ActionSchema, CollectionSchema, FieldSchema } from './interfaces/schema';

export default abstract class BaseCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name = null;
  readonly schema: CollectionSchema = null;

  private actions: { [actionName: string]: Action } = {};

  constructor(name: string, datasource: DataSource) {
    this.dataSource = datasource;
    this.name = name;
    this.schema = {
      actions: {},
      fields: {},
      searchable: false,
      segments: [],
    };
  }

  getAction(name: string): Action {
    const action = this.actions[name];

    if (action === undefined) throw new Error(`Action "${name}" not found.`);

    return action;
  }

  protected addAction(name: string, schema: ActionSchema, instance: Action): void {
    const action = this.actions[name];

    if (action !== undefined) throw new Error(`Action "${name}" already defined in collection`);

    this.actions[name] = instance;
    this.schema.actions[name] = schema;
  }

  protected addField(name: string, schema: FieldSchema): void {
    const fieldSchema = this.schema.fields[name];

    if (fieldSchema !== undefined) throw new Error(`Field "${name}" already defined in collection`);

    this.schema.fields[name] = schema;
  }

  protected addFields(fields: { [fieldName: string]: FieldSchema }): void {
    Object.entries(fields).forEach(([fieldName, fieldSchema]) =>
      this.addField(fieldName, fieldSchema),
    );
  }

  protected enableSearch(): void {
    this.schema.searchable = true;
  }

  abstract getById(id: CompositeId, projection: Projection): Promise<RecordData>;

  abstract create(data: RecordData[]): Promise<RecordData[]>;

  abstract list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  abstract update(filter: Filter, patch: RecordData): Promise<void>;

  abstract delete(filter: Filter): Promise<void>;

  abstract aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]>;
}
