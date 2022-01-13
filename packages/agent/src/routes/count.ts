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

  public async handleCount(ctx: Context): Promise<void> {
    const paginatedFilter: PaginatedFilter = {};
    const aggregation: Aggregation = { operation: AggregationOperation.Count };

    const aggregationResult = await this.collection.aggregate(paginatedFilter, aggregation);

    // @fixme quite ugly
    ctx.response.body = { count: aggregationResult?.[0]?.value ?? 0 };
  }
}
