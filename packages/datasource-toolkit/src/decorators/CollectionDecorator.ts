import {
  AggregateResult,
  Aggregation,
  Collection,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '../index';

export default abstract class CollectionDecorator {
  protected collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const refinedFilter = this.refineFilter(filter);

    return this.collection.list(refinedFilter, projection);
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    const refinedFilter = this.refineFilter(filter);

    return this.collection.update(refinedFilter, patch);
  }

  async delete(filter: Filter): Promise<void> {
    const refinedFilter = this.refineFilter(filter);

    return this.collection.delete(refinedFilter);
  }

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    const refinedFilter = this.refineFilter(filter);

    return this.collection.aggregate(refinedFilter, aggregation);
  }

  protected abstract refineFilter(filter: Filter): Filter;
}
