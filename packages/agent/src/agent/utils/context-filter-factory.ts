import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import QueryStringParser from './query-string';

export default class ContextFilterFactory {
  static buildPaginated(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<PaginatedFilter>,
  ): PaginatedFilter {
    return new PaginatedFilter({
      search: QueryStringParser.parseSearch(collection, context),
      segment: QueryStringParser.parseSegment(collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      sort: QueryStringParser.parseSort(collection, context),
      page: QueryStringParser.parsePagination(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(collection, context),
        scope,
      ),
      ...partialFilter,
    });
  }
}
