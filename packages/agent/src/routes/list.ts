import { Context } from 'koa';
import Router from '@koa/router';
import { PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import QueryStringParser from '../utils/query-string';
import CollectionBaseRoute from './collection-base-route';

export default class ListRoute extends CollectionBaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    const paginatedFilter: PaginatedFilter = {};
    const projection: Projection = QueryStringParser.parseProjection(this.collection, context);

    try {
      const records = await this.collection.list(paginatedFilter, projection);

      context.response.body = this.services.serializer.serialize(this.collection, records);
    } catch {
      context.throw(400, `Failed to list collection "${this.collection.name}"`);
    }
  }
}
