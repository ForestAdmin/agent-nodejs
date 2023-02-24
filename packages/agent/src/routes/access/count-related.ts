import { Aggregation, CollectionUtils } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import CountFilterParser from '../../utils/query-parser/filter/count';
import RelationRoute from '../relation-route';

export default class CountRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}/count`,
      this.handleCountRelated.bind(this),
    );
  }

  public async handleCountRelated(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    if (this.foreignCollection.schema.countable) {
      const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
      const scope = await this.services.authorization.getScope(this.foreignCollection, context);
      const caller = CallerParser.fromCtx(context);
      const filter = CountFilterParser.fromCtx(this.foreignCollection, context).intersectWith(
        scope,
      );

      const aggregationResult = await CollectionUtils.aggregateRelation(
        this.collection,
        parentId,
        this.relationName,
        caller,
        filter,
        new Aggregation({ operation: 'Count' }),
      );

      context.response.body = { count: aggregationResult?.[0]?.value ?? 0 };
    } else {
      context.response.body = { meta: { count: 'deactivated' } };
    }
  }
}
