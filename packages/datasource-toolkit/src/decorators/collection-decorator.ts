import {
  Action,
  AggregateResult,
  Aggregation,
  Collection,
  CollectionSchema,
  CompositeId,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '../index';

export default abstract class CollectionDecorator implements Collection {
  readonly dataSource: DataSource;
  protected childCollection: Collection;

  constructor(childCollection: Collection, dataSource: DataSource) {
    this.childCollection = childCollection;
    this.dataSource = dataSource;
  }

  get name(): string {
    return this.childCollection.name;
  }

  get schema(): CollectionSchema {
    return this.refineSchema(this.childCollection.schema);
  }

  async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    return this.childCollection.getById(id, projection);
  }

  getAction(name: string): Action {
    return this.childCollection.getAction(name);
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return this.childCollection.create(data);
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const refinedFilter = this.refineFilter(filter);

    return this.childCollection.list(refinedFilter, projection);
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    const refinedFilter = this.refineFilter(filter);

    return this.childCollection.update(refinedFilter, patch);
  }

  async delete(filter: Filter): Promise<void> {
    const refinedFilter = this.refineFilter(filter);

    return this.childCollection.delete(refinedFilter);
  }

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    const refinedFilter = this.refineFilter(filter);

    return this.childCollection.aggregate(refinedFilter, aggregation);
  }

  protected refineFilter(filter?: PaginatedFilter): PaginatedFilter {
    return filter;
  }

  protected abstract refineSchema(subSchema: CollectionSchema): CollectionSchema;
}
