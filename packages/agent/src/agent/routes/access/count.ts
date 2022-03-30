import { Aggregation, AggregationOperation } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';

export default class CountRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    await this.services.permissions.can(context, `browse:${this.collection.name}`);

    const scope = await this.services.permissions.getScope(this.collection, context);
    const filter = ContextFilterFactory.build(this.collection, context, scope);

    const aggregation = new Aggregation({ operation: AggregationOperation.Count });
    const aggregationResult = await this.collection.aggregate(filter, aggregation);
    const count = aggregationResult?.[0]?.value ?? 0;

    context.response.body = { count };
  }
}
