import { ActionField, ActionResult } from './interfaces/action';
import { ActionSchema, CollectionSchema, FieldSchema } from './interfaces/schema';
import { Collection, DataSource } from './interfaces/collection';
import { RecordData } from './interfaces/record';
import Aggregation, { AggregateResult } from './interfaces/query/aggregation';
import Filter from './interfaces/query/filter/unpaginated';
import PaginatedFilter from './interfaces/query/filter/paginated';
import Projection from './interfaces/query/projection';

/** Class BaseCollection */
export default abstract class BaseCollection implements Collection {
  readonly dataSource: DataSource = null;
  readonly name: string = null;
  readonly schema: CollectionSchema = null;

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

  protected addAction(name: string, schema: ActionSchema): void {
    const action = this.schema.actions[name];

    if (action !== undefined) throw new Error(`Action "${name}" already defined in collection`);

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

  protected addSegments(segments: string[]) {
    this.schema.segments.push(...segments);
  }

  protected enableSearch(): void {
    this.schema.searchable = true;
  }

  abstract create(data: RecordData[]): Promise<RecordData[]>;

  abstract list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  abstract update(filter: Filter, patch: RecordData): Promise<void>;

  abstract delete(filter: Filter): Promise<void>;

  abstract aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]>;

  async execute(name: string): Promise<ActionResult> {
    throw new Error(
      this.schema.actions[name]
        ? `Action ${name} is not implemented.`
        : `No action named ${name} was added`,
    );
  }

  async getForm(): Promise<ActionField[]> {
    return [];
  }
}
