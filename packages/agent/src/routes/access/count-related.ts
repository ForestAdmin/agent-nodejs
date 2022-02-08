import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  CompositeId,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';
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
    let paginatedFilter: PaginatedFilter;

    try {
      parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
      paginatedFilter = new PaginatedFilter({
        search: QueryStringParser.parseSearch(context),
        searchExtended: QueryStringParser.parseSearchExtended(context),
        segment: QueryStringParser.parseSegment(this.collection, context),
        timezone: QueryStringParser.parseTimezone(context),
      });
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    try {
      const aggregationResult = await CollectionUtils.aggregateRelation(
        paginatedFilter,
        Number(parentId[0]),
        this.collection,
        this.relationName,
        new Aggregation({ operation: AggregationOperation.Count }),
        this.dataSource,
      );
      const countValue = aggregationResult?.[0]?.value;
      const count = countValue ?? 0;

      context.response.body = { count };
    } catch (e) {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to count the collection relation of the "${this.collection.name}"`,
      );
    }
  }
}
