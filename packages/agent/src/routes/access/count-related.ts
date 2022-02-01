import {
  Aggregation,
  AggregationOperation,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';
import { RelationRoute } from '../collection-base-route';

export default class CountRelatedRoute extends RelationRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}/count`,
      this.handleCountRelated.bind(this),
    );
  }

  public async handleCountRelated(context: Context): Promise<void> {
    const paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });
    const aggregation = new Aggregation({ operation: AggregationOperation.Count });

    try {
      const aggregationResult = await this.collection.aggregate(paginatedFilter, aggregation);
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } catch {
      context.throw(500, `Failed to count collection "${this.collection.name}"`);
    }
  }
}
