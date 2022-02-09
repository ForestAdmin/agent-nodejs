import { CollectionUtils, CompositeId, PaginatedFilter } from '@forestadmin/datasource-toolkit';
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

    const paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });

    const relationCollection = this.collection.dataSource.getCollection(this.relationName);
    const projection = QueryStringParser.parseProjection(relationCollection, context);

    try {
      parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
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

      context.response.body = this.services.serializer.serialize(relationCollection, records);
    } catch (e) {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to get the collection relation of the "${this.collection.name}"`,
      );
    }
  }
}
