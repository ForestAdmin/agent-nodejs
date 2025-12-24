import type { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import type { Context } from 'koa';

import { ConditionTreeFactory, Filter, PaginatedFilter } from '@forestadmin/datasource-toolkit';

import QueryStringParser from './query-string';

export default class ContextFilterFactory {
  static buildPaginated(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<PaginatedFilter>,
  ): PaginatedFilter {
    return new PaginatedFilter({
      sort: QueryStringParser.parseSort(collection, context),
      page: QueryStringParser.parsePagination(context),
      ...ContextFilterFactory.build(collection, context, scope),
      ...partialFilter,
    });
  }

  static build(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<Filter>,
  ): PaginatedFilter {
    return new Filter({
      search: QueryStringParser.parseSearch(collection, context),
      segment: QueryStringParser.parseSegment(collection, context),
      liveQuerySegment: QueryStringParser.parseLiveQuerySegment(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(collection, context),
        scope,
      ),
      ...partialFilter,
    });
  }
}
