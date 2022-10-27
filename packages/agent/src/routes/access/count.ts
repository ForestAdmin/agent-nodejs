import { Aggregation } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import ContextFilterFactory from '../../utils/context-filter-factory';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class CountRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    await this.services.permissions.can(context, `browse:${this.collection.name}`);

    if (this.collection.schema.countable) {
      const scope = await this.services.permissions.getScope(this.collection, context);
      const caller = QueryStringParser.parseCaller(context);
      const filter = ContextFilterFactory.build(this.collection, context, scope);

      const aggregation = new Aggregation({ operation: 'Count' });
      const aggregationResult = await this.collection.aggregate(caller, filter, aggregation);
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } else {
      context.response.body = { meta: { count: 'deactivated' } };
    }
  }
}
