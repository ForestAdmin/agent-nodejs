import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  CompositeId,
  ManyToManySchema,
  ManyToOneSchema,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';
import { RelationRoute } from '../collection-base-route';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';

export default class CountRelatedRoute extends RelationRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}/count`,
      this.handleCountRelated.bind(this),
    );
  }

  public async handleCountRelated(context: Context): Promise<void> {
    let parentId: CompositeId;

    try {
      parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    const paginatedFilter = new PaginatedFilter({
      search: QueryStringParser.parseSearch(context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.collection, context),
    });

    try {
      const aggregationResult = await CollectionUtils.aggregateRelation(
        paginatedFilter,
        parentId,
        this.collection,
        this.relationName,
        new Aggregation({ operation: AggregationOperation.Count }),
        this.dataSource,
      );
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } catch {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to count collection "${this.collection.name}"`,
      );
    }
  }
}
