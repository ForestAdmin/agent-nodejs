import type Router from '@koa/router';
import type { Context } from 'koa';

import { ConditionTreeFactory, PaginatedFilter } from '@forestadmin/datasource-toolkit';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class GetRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collectionUrlSlug}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        ConditionTreeFactory.matchIds(this.collection.schema, [id]),
        await this.services.authorization.getScope(this.collection, context),
      ),
    });

    const projection = await this.services.authorization.redactProjection(
      context,
      this.collection,
      QueryStringParser.parseProjectionFromHeaderOrQuery(this.collection, context),
    );

    const caller = QueryStringParser.parseCaller(context);
    const queried = projection.withPks(this.collection);
    const relationScopes = await this.services.authorization.getRelationScopes(
      context,
      this.collection,
      queried,
    );
    const records = relationScopes.redact(
      await this.collection.list(caller, filter, relationScopes.withScopeFields(queried)),
      queried,
      caller.timezone,
    );

    if (!records.length) {
      context.throw(HttpCode.NotFound, 'Record does not exists');
    }

    context.response.body = this.services.serializer.serialize(this.collection, records[0]);
  }
}
