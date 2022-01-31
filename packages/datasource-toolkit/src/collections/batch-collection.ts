/* eslint-disable no-await-in-loop */

import Aggregation, {
  AggregateResult,
  AggregateResultGenerator,
} from '../interfaces/query/aggregation';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Page from '../interfaces/query/page';
import Projection from '../interfaces/query/projection';
import Sort from '../interfaces/query/sort';
import { RecordData, RecordDataGenerator } from '../interfaces/record';
import SchemaUtils from '../utils/schema';
import BaseCollection from './base-collection';

export default abstract class BatchCollection extends BaseCollection {
  async *list(filter: PaginatedFilter, projection: Projection): RecordDataGenerator {
    const sort = this.getStableSort(filter?.sort);

    for (const page of this.paginate(filter?.page)) {
      const pageFilter = filter.override({ page, sort });
      const records = await this.batchList(pageFilter, projection);
      yield* records;

      if (records.length < page.limit) break;
    }
  }

  async *aggregate(filter: PaginatedFilter, aggregation: Aggregation): AggregateResultGenerator {
    for (const page of this.paginate(filter?.page)) {
      const pageFilter = filter.override({ page });
      const rows = await this.batchAggregate(pageFilter, aggregation);
      yield* rows;

      if (rows.length < page.limit) break;
    }
  }

  protected abstract batchList(
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]>;

  protected abstract batchAggregate(
    filter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]>;

  private *paginate(page?: Page): Generator<Page> {
    const chunkSize = 2000;
    const endAt = page?.limit ?? Number.MAX_SAFE_INTEGER;

    let startAt = page?.skip ?? 0;

    while (startAt + chunkSize < endAt) {
      yield new Page(startAt, chunkSize);
      startAt += chunkSize;
    }

    yield new Page(startAt, endAt - startAt);
  }

  private getStableSort(initial?: Sort): Sort {
    const result = (initial?.slice() ?? new Sort()) as Sort;
    SchemaUtils.getPrimaryKeys(this.schema).forEach(pk => {
      if (result.projection.includes(pk)) result.push({ field: pk, ascending: true });
    });

    return result;
  }
}
