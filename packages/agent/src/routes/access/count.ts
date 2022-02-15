import {
  Aggregation,
  AggregationOperation,
  ConditionTreeFactory,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import QueryStringParser from '../../utils/query-string';

export default class CountRoute extends CollectionRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    const paginatedFilter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.scope.getConditionTree(this.collection, context),
      ),
      search: QueryStringParser.parseSearch(this.collection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    const aggregation = new Aggregation({ operation: AggregationOperation.Count });
    const aggregationResult = await this.collection.aggregate(paginatedFilter, aggregation);
    const count = aggregationResult?.[0]?.value ?? 0;

    context.response.body = { count };
  }
}
