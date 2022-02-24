import {
  ConditionTreeFactory,
  Page,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import CollectionRoute from '../collection-route';
import CsvConverter from '../../utils/csv-converter';
import QueryStringParser from '../../utils/query-string';

const PAGE_SIZE = 1000;

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    const { query } = context.request;
    const projection = QueryStringParser.parseProjection(this.collection, context);
    const paginatedFilter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.permissions.getScope(this.collection, context),
      ),
      search: QueryStringParser.parseSearch(this.collection, context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });

    context.response.type = 'text/csv; charset=utf-8';
    context.response.attachment(`attachment; filename=${query.filename}`);
    context.response.lastModified = new Date();
    context.response.set({ 'X-Accel-Buffering': 'no' });
    context.response.set({ 'Cache-Control': 'no-cache' });
    context.response.body = Readable.from(
      this.generateCsv(projection, paginatedFilter, query.header),
    );
  }

  /**
   * Use an async generator to ensure that
   * - backpressure is properly applied without needing to extend Readable (for slow clients)
   * - we stop making queries to the database if the client closes the connection.
   */
  private async *generateCsv(
    projection: Projection,
    paginatedFilter: PaginatedFilter,
    header: string | string[],
  ): AsyncGenerator<string> {
    yield `${header?.toString?.()}\n`;
    let skip = 0;
    let isAllRecordFetched = false;

    while (!isAllRecordFetched) {
      paginatedFilter.page = new Page(skip, PAGE_SIZE);
      // eslint-disable-next-line no-await-in-loop
      const records = await this.collection.list(paginatedFilter, projection);

      yield CsvConverter.convert(records, projection);

      isAllRecordFetched = records.length < PAGE_SIZE;
      skip += PAGE_SIZE;
    }
  }
}
