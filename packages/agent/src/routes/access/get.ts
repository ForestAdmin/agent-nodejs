import { ConditionTreeFactory, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

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

    const records = await this.collection.list(
      QueryStringParser.parseCaller(context),
      filter,
      QueryStringParser.parseProjectionWithPks(this.collection, context),
    );

    if (!records.length) {
      context.throw(HttpCode.NotFound, 'Record does not exists');
    }

    context.response.body = this.services.serializer.serialize(this.collection, records[0]);
  }
}
