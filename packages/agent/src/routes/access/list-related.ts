import {
  CollectionUtils,
  ConditionTreeFactory,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class ListRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleListRelated.bind(this),
    );
  }

  public async handleListRelated(context: Context): Promise<void> {
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(this.foreignCollection, context),
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.scope.getConditionTree(this.foreignCollection, context),
      ),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.foreignCollection, context),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),
    });

    const projection = QueryStringParser.parseProjection(this.foreignCollection, context);

    const records = await CollectionUtils.listRelation(
      this.collection,
      parentId,
      this.relationName,
      paginatedFilter,
      projection,
    );

    context.response.body = this.services.serializer.serialize(this.foreignCollection, records);
  }
}
