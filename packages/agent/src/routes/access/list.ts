import { ConditionTreeFactory, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import QueryStringParser from '../../utils/query-string';

export default class ListRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}`, this.handleList.bind(this));
  }

  public async handleList(context: Context) {
    await this.services.permissions.can(context, `browse:${this.collection.name}`);

    const paginatedFilter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.permissions.getScope(this.collection, context),
      ),
      search: QueryStringParser.parseSearch(this.collection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });

    const projection = QueryStringParser.parseProjection(this.collection, context);
    const records = await this.collection.list(paginatedFilter, projection);

    context.response.body = this.services.serializer.serialize(this.collection, records);
  }
}
