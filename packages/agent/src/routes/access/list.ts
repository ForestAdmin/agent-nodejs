import { PaginatedFilter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-base-route';

export default class ListRoute extends CollectionRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    const paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });
    const projection = QueryStringParser.parseProjection(this.collection, context);

    try {
      const records = await this.collection.list(paginatedFilter, projection);

      context.response.body = this.services.serializer.serialize(this.collection, records);
    } catch {
      context.throw(500, `Failed to list collection "${this.collection.name}"`);
    }
  }
}
