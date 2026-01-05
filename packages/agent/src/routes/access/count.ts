import type Router from '@koa/router';
import type { Context } from 'koa';

import { Aggregation } from '@forestadmin/datasource-toolkit';

import ContextFilterFactory from '../../utils/context-filter-factory';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class CountRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collectionUrlSlug}/count`, this.handleCount.bind(this));
  }

  public async handleCount(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    if (this.collection.schema.countable) {
      const scope = await this.services.authorization.getScope(this.collection, context);
      const caller = QueryStringParser.parseCaller(context);
      let filter = ContextFilterFactory.build(this.collection, context, scope);
      filter = await this.services.segmentQueryHandler.handleLiveQuerySegmentFilter(
        context,
        filter,
      );

      const aggregation = new Aggregation({ operation: 'Count' });
      const aggregationResult = await this.collection.aggregate(caller, filter, aggregation);
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } else {
      context.response.body = { meta: { count: 'deactivated' } };
    }
  }
}
