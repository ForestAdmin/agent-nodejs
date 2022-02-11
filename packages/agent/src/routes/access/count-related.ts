import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
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

    try {
      parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    const paginatedFilter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.scope.getConditionTree(this.foreignCollection, context),
      ),
      search: QueryStringParser.parseSearch(this.foreignCollection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    try {
      const aggregationResult = await CollectionUtils.aggregateRelation(
        this.collection,
        parentId,
        this.relationName,
        paginatedFilter,
        new Aggregation({ operation: AggregationOperation.Count }),
      );
      const count = aggregationResult?.[0]?.value ?? 0;

      context.response.body = { count };
    } catch (e) {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to count the collection relation of the "${this.collection.name}"`,
      );
    }
  }
}
