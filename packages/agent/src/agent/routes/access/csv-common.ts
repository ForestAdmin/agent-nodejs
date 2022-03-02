import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';

export default class CsvCommon {
  static buildResponseContext(context: Context): void {
    const { filename } = context.request.query;

    context.response.type = 'text/csv; charset=utf-8';
    context.response.attachment(`attachment; filename=${filename}`);
    context.response.lastModified = new Date();
    context.response.set({ 'X-Accel-Buffering': 'no' });
    context.response.set({ 'Cache-Control': 'no-cache' });
  }

  static buildFilter(
    context: Context,
    collection: Collection,
    scope: ConditionTree,
  ): PaginatedFilter {
    return new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(collection, context),
        scope,
      ),
      search: QueryStringParser.parseSearch(collection, context),
      segment: QueryStringParser.parseSegment(collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      sort: QueryStringParser.parseSort(collection, context),
      page: QueryStringParser.parsePagination(context),
    });
  }
}
