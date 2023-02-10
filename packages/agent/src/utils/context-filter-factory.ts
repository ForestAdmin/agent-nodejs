import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import QueryStringParser from './query-string';

export default class ContextFilterFactory {
  static buildPaginated(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<Filter>,
  ): Filter {
    return new Filter({
      ...ContextFilterFactory.build(collection, context, scope),
      sort: QueryStringParser.parseSort(collection, context),
      page: QueryStringParser.parsePagination(context),
      ...partialFilter,
    });
  }

  static build(
    collection: Collection,
    context: Context,
    scope: ConditionTree,
    partialFilter?: Partial<Filter>,
  ): Filter {
    return new Filter({
      search: QueryStringParser.parseSearch(collection, context),
      segment: QueryStringParser.parseSegment(collection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(collection, context),
        scope,
      ),
      ...partialFilter,
    });
  }
}
