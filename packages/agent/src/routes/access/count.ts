import { Aggregation } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import CallerParser from '../../utils/query-parser/caller';
import CountFilterParser from '../../utils/query-parser/filter/count';
import CollectionRoute from '../collection-route';

export default class CountRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    if (this.collection.schema.countable) {
      const scope = await this.services.authorization.getScope(this.collection, context);
      const caller = CallerParser.fromCtx(context);
      const filter = CountFilterParser.fromCtx(this.collection, context).intersectWith(scope);

      const aggregation = new Aggregation({ operation: 'Count' });
      const aggregationResult = await this.collection.aggregate(caller, filter, aggregation);
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } else {
      context.response.body = { meta: { count: 'deactivated' } };
    }
  }
}
