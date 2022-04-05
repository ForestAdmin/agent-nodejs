import { ActionField, ActionResult } from '../interfaces/action';
import { Collection, DataSource } from '../interfaces/collection';
import { CollectionSchema } from '../interfaces/schema';
import { RecordData } from '../interfaces/record';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import Filter from '../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Projection from '../interfaces/query/projection';

export default abstract class CollectionDecorator implements Collection {
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

  async execute(name: string, data: RecordData, filter?: Filter): Promise<ActionResult> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.execute(name, data, refinedFilter);
  }

  async getForm(name: string, data?: RecordData, filter?: Filter): Promise<ActionField[]> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.getForm(name, data, refinedFilter);
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return this.childCollection.create(data);
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.list(refinedFilter, projection);
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.update(refinedFilter, patch);
  }

  async delete(filter: Filter): Promise<void> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.delete(refinedFilter);
  }

  async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const refinedFilter = await this.refineFilter(filter);

    return this.childCollection.aggregate(refinedFilter, aggregation, limit);
  }

  protected markSchemaAsDirty(): void {
    this.lastSchema = null;
  }

  protected async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter;
  }

  protected abstract refineSchema(subSchema: CollectionSchema): CollectionSchema;
}
