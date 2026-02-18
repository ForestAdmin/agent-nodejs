/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ActionField, ActionResult } from './interfaces/action';
import type { Caller } from './interfaces/caller';
import type { Chart } from './interfaces/chart';
import type { Collection, DataSource, GetFormMetas } from './interfaces/collection';
import type { AggregateResult } from './interfaces/query/aggregation';
import type Aggregation from './interfaces/query/aggregation';
import type PaginatedFilter from './interfaces/query/filter/paginated';
import type Filter from './interfaces/query/filter/unpaginated';
import type Projection from './interfaces/query/projection';
import type { CompositeId, RecordData } from './interfaces/record';
import type {
  ActionSchema,
  AggregationCapabilities,
  CollectionSchema,
  FieldSchema,
} from './interfaces/schema';

import { SchemaUtils } from './index';

export default abstract class BaseCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name: string;
  readonly schema: CollectionSchema;
  readonly nativeDriver: unknown;

  constructor(name: string, datasource: DataSource, nativeDriver: unknown = null) {
    this.dataSource = datasource;
    this.name = name;
    this.nativeDriver = nativeDriver;
    this.schema = {
      actions: {},
      charts: [],
      countable: false,
      fields: {},
      searchable: false,
      segments: [],
      aggregationCapabilities: {
        supportGroups: true,
        supportedDateOperations: new Set(['Year', 'Quarter', 'Month', 'Week', 'Day']),
      },
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
    SchemaUtils.throwIfAlreadyDefinedField(this.schema, name, this.name);

    if (schema.type === 'Column' && schema.isGroupable === undefined) schema.isGroupable = true;

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

  protected setAggregationCapabilities(capabilities: AggregationCapabilities): void {
    this.schema.aggregationCapabilities = capabilities;
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

  async execute(
    caller: Caller,
    name: string,
    formValues: RecordData,
    filter?: Filter,
  ): Promise<ActionResult> {
    throw new Error(`Action ${name} is not implemented.`);
  }

  async getForm(
    caller: Caller,
    name: string,
    formValues?: RecordData,
    filter?: Filter,
    metas?: GetFormMetas,
  ): Promise<ActionField[]> {
    return [];
  }

  async renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart> {
    throw new Error(`Chart ${name} is not implemented.`);
  }
}
