import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';
import QueryStringParser from '../../utils/query-string';

export default class ListRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    await this.services.permissions.can(context, `browse:${this.collection.name}`);

    const scope = await this.services.permissions.getScope(this.collection, context);
    const paginatedFilter = ContextFilterFactory.buildPaginated(this.collection, context, scope);
    const projection = QueryStringParser.parseProjectionWithPks(this.collection, context);
    const records = await this.collection.list(paginatedFilter, projection);

    context.response.body = this.services.serializer.serialize(this.collection, records);
  }
}
