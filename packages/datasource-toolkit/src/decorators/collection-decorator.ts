import { ActionField, ActionResult } from '../interfaces/action';
import { Caller } from '../interfaces/caller';
import { Collection, DataSource } from '../interfaces/collection';
import { CollectionSchema } from '../interfaces/schema';
import { RecordData } from '../interfaces/record';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import Filter from '../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Projection from '../interfaces/query/projection';

export default class CollectionDecorator implements Collection {
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
