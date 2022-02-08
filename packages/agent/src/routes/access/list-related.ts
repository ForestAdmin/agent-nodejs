import {
  CollectionUtils,
  CompositeId,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';

export default class ListRelatedRoute extends RelationRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleListRelated.bind(this),
    );
  }

  public async handleListRelated(context: Context): Promise<void> {
    let parentId: CompositeId;
    let paginatedFilter: PaginatedFilter;
    let projection: Projection;

    paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });

    try {
      parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

      projection = QueryStringParser.parseProjection(this.collection, context);
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    try {
      const records = await CollectionUtils.listRelation(
        this.collection,
        parentId,
        this.relationName,
        paginatedFilter,
        projection,
      );

      context.response.body = this.services.serializer.serialize(this.collection, records);
    } catch {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to list collection "${this.collection.name}"`,
      );
    }
  }
}
