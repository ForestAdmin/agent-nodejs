import { ActionField, ActionResult } from './interfaces/action';
import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import { Collection, DataSource } from './interfaces/collection';
import Aggregation, { AggregateResult } from './interfaces/query/aggregation';
import PaginatedFilter from './interfaces/query/filter/paginated';
import Filter from './interfaces/query/filter/unpaginated';
import Projection from './interfaces/query/projection';
import { RecordData } from './interfaces/record';
import { ActionSchema, CollectionSchema, FieldSchema } from './interfaces/schema';

export type CollectionCapabilities = {
  canList: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canChart: boolean;
  canCount: boolean;
  canNativeQuery: boolean;
  canSearch: boolean;
};

export default abstract class BaseCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name: string;
  readonly schema: CollectionSchema;
  readonly nativeDriver: unknown;

  constructor(
    name: string,
    datasource: DataSource,
    nativeDriver: unknown = null,
    collectionCapabilitiesP: CollectionCapabilities = null,
  ) {
    this.dataSource = datasource;
    this.name = name;
    this.nativeDriver = nativeDriver;

    let collectionCapabilities = null;

    if (collectionCapabilitiesP === null) {
      collectionCapabilities = {
        canChart: true,
        canCount: true,
        canCreate: true,
        canDelete: true,
        canList: true,
        canNativeQuery: !!nativeDriver,
        canSearch: true,
        canUpdate: true,
      };
    } else {
      collectionCapabilities = collectionCapabilitiesP;
    }

    this.schema = {
      actions: {},
      charts: [],
      fields: {},
      segments: [],
      searchable: false,
      chartable: collectionCapabilities.canChart,
      listable: collectionCapabilities.canList,
      creatable: collectionCapabilities.canCreate,
      updatable: collectionCapabilities.canUpdate,
      deletable: collectionCapabilities.canDelete,
      countable: collectionCapabilities.canCount,
      supportNativeQuery: collectionCapabilities.canNativeQuery,
    };
  }

  protected addAction(name: string, schema: ActionSchema): void {
    const action = this.schema.actions[name];

    if (action !== undefined) throw new Error(`Action "${name}" already defined in collection`);

    this.schema.actions[name] = schema;
  }

  protected addChart(name: string): void {
    if (this.schema.charts.includes(name)) {
      throw new Error(`Chart "${name}" already defined in collection`);
    }

    this.schema.charts.push(name);
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

  protected enableCount(): void {
    this.schema.countable = true;
  }

  protected enableSearch(): void {
    this.schema.searchable = true;
  }

  abstract create(caller: Caller, data: RecordData[]): Promise<RecordData[]>;

  abstract list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]>;

  abstract update(caller: Caller, filter: Filter, patch: RecordData): Promise<void>;

  abstract delete(caller: Caller, filter: Filter): Promise<void>;

  abstract aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]>;

  async execute(caller: Caller, name: string): Promise<ActionResult> {
    throw new Error(`Action ${name} is not implemented.`);
  }

  async getForm(): Promise<ActionField[]> {
    return [];
  }

  async renderChart(caller: Caller, name: string): Promise<Chart> {
    throw new Error(`Chart ${name} is not implemented.`);
  }
}
