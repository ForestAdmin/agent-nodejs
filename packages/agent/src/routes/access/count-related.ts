import type Router from '@koa/router';
import type { Context } from 'koa';

import { Aggregation, CollectionUtils } from '@forestadmin/datasource-toolkit';

import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class CountRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collectionUrlSlug}/:parentId/relationships/${this.relationUrlSlug}/count`,
      this.handleCountRelated.bind(this),
    );
  }

  public async handleCountRelated(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    if (this.foreignCollection.schema.countable) {
      const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
      const scope = await this.services.authorization.getScope(this.foreignCollection, context);
      const caller = QueryStringParser.parseCaller(context);
      const filter = ContextFilterFactory.build(this.foreignCollection, context, scope);

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
