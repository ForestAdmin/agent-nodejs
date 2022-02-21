import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  ConditionTreeFactory,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class CountRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}/count`,
      this.handleCountRelated.bind(this),
    );
  }

  public async handleCountRelated(context: Context): Promise<void> {
    await this.services.permissions.can(context, `browse:${this.collection.name}`);

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const paginatedFilter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.permissions.getScope(this.foreignCollection, context),
      ),
      search: QueryStringParser.parseSearch(this.foreignCollection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),

      timezone: QueryStringParser.parseTimezone(context),
    });

    const aggregationResult = await CollectionUtils.aggregateRelation(
      this.collection,
      parentId,
      this.relationName,
      paginatedFilter,
      new Aggregation({ operation: AggregationOperation.Count }),
    );

    context.response.body = { count: aggregationResult?.[0]?.value ?? 0 };
  }
}
