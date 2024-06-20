import { ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class RpcDeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/rpc/${this.collectionUrlSlug}/delete`, this.handleDelete.bind(this));
  }

  public async handleDelete(context: Context) {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const queryFilter = JSON.parse(context.query.filter as string);

    const filter = new Filter({
      ...queryFilter,
      conditionTree: queryFilter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(queryFilter.conditionTree)
        : undefined,
    });

    await this.collection.delete(QueryStringParser.parseCaller(context), filter);

    context.response.status = HttpCode.NoContent;
  }
}
