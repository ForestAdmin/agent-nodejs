import type { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import type { Context } from 'koa';

import {
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Sort,
  SortFactory,
} from '@forestadmin/datasource-toolkit';

import QueryStringParser from './query-string';

export default class ContextFilterFactory {
  static buildPaginated(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<PaginatedFilter>,
  ): PaginatedFilter {
    return new PaginatedFilter({
      sort: ContextFilterFactory.withPrimaryKeyTiebreaker(
        collection,
        QueryStringParser.parseSort(collection, context),
      ),
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

  private static withPrimaryKeyTiebreaker(collection: Collection, sort: Sort): Sort {
    if (sort.length === 0) return sort;

    const { ascending } = sort[sort.length - 1];
    const missingPrimaryKeys = SortFactory.byPrimaryKeys(collection)
      .filter(({ field }) => !sort.some(clause => clause.field === field))
      .map(({ field }) => ({ field, ascending }));

    return new Sort(...sort, ...missingPrimaryKeys);
  }
}
