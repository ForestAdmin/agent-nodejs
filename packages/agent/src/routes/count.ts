import {
  Aggregation,
  AggregationOperation,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import CollectionBaseRoute from './collection-base-route';

export default class Count extends CollectionBaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    const paginatedFilter: PaginatedFilter = {};
    const aggregation: Aggregation = { operation: AggregationOperation.Count };

    try {
      const aggregationResult = await this.collection.aggregate(paginatedFilter, aggregation);
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } catch {
      context.throw(500, `Failed to count collection "${this.collection.name}"`);
    }
  }
}
