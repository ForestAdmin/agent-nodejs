import { Aggregation, CollectionUtils } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
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
    const scope = await this.services.permissions.getScope(this.foreignCollection, context);
    const filter = ContextFilterFactory.build(this.foreignCollection, context, scope);

    const aggregationResult = await CollectionUtils.aggregateRelation(
      this.collection,
      parentId,
      this.relationName,
      filter,
      new Aggregation({ operation: 'Count' }),
    );

    context.response.body = { count: aggregationResult?.[0]?.value ?? 0 };
  }
}
