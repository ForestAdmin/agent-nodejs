import Router from '@koa/router';
import { Context } from 'koa';

import CallerParser from '../../utils/query-parser/caller';
import ListFilterParser from '../../utils/query-parser/filter/list';
import ProjectionParser from '../../utils/query-parser/projection';
import CollectionRoute from '../collection-route';

export default class ListRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const filter = ListFilterParser.fromCtx(this.collection, context).intersectWith(scope);

    const records = await this.collection.list(
      CallerParser.fromCtx(context),
      filter,
      ProjectionParser.fromCtx(this.collection, context).withPks(this.collection),
    );

    context.response.body = this.services.serializer.serializeWithSearchMetadata(
      this.collection,
      records,
      filter.search,
    );
  }
}
