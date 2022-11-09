import {
  ActionField,
  ActionResult,
  AggregateResult,
  Aggregation,
  Caller,
  Chart,
  Collection,
  CollectionSchema,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class CollectionDecorator extends Collection {
  readonly dataSource: DataSource;
  protected childCollection: Collection;

  private lastSchema: CollectionSchema;
  private lastSubSchema: CollectionSchema;

  get schema(): CollectionSchema {
    const subSchema = this.childCollection.schema;

    if (!this.lastSchema || this.lastSubSchema !== subSchema) {
      this.lastSchema = this.refineSchema(subSchema);
      this.lastSubSchema = subSchema;
    }

    return this.lastSchema;
  }

  get name(): string {
    return this.childCollection.name;
  }

  constructor(childCollection: Collection, dataSource: DataSource) {
    super();

    this.childCollection = childCollection;
    this.dataSource = dataSource;
  }

  async execute(
    caller: Caller,
    name: string,
    data: RecordData,
    filter?: Filter,
  ): Promise<ActionResult> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.execute(caller, name, data, refinedFilter);
  }

  async getForm(
    caller: Caller,
    name: string,
    data?: RecordData,
    filter?: Filter,
  ): Promise<ActionField[]> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.getForm(caller, name, data, refinedFilter);
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    return this.childCollection.create(caller, data);
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.list(caller, refinedFilter, projection);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.update(caller, refinedFilter, patch);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.delete(caller, refinedFilter);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.aggregate(caller, refinedFilter, aggregation, limit);
  }

  async renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart> {
    return this.childCollection.renderChart(caller, name, recordId);
  }

  protected markSchemaAsDirty(): void {
    this.lastSchema = null;
  }

  protected async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter;
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return subSchema;
  }
}
