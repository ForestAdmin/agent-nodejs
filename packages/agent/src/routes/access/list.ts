import type Router from '@koa/router';
import type { Context } from 'koa';

import ContextFilterFactory from '../../utils/context-filter-factory';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class ListRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collectionUrlSlug}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);
    await this.services.authorization.assertCanReadQueryFields(context, this.collection);

    const scope = await this.services.authorization.getScope(this.collection, context);
    let paginatedFilter = ContextFilterFactory.buildPaginated(this.collection, context, scope);
    paginatedFilter = await this.services.segmentQueryHandler.handleLiveQuerySegmentFilter(
      context,
      paginatedFilter,
    );

    const projection = await this.services.authorization.redactProjection(
      context,
      this.collection,
      QueryStringParser.parseProjectionFromHeaderOrQuery(this.collection, context),
    );

    const records = await this.collection.list(
      QueryStringParser.parseCaller(context),
      paginatedFilter,
      projection.withPks(this.collection),
    );

    context.response.body = this.services.serializer.serializeWithSearchMetadata(
      this.collection,
      records,
      paginatedFilter.search,
    );
  }
}
