import { ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class RpcUpdateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(`/rpc/${this.collectionUrlSlug}/update`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context) {
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    const queryFilter = JSON.parse(context.query.filter as string);

    const filter = new Filter({
      ...queryFilter,
      conditionTree: queryFilter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(queryFilter.conditionTree)
        : undefined,
    });

    await this.collection.update(
      QueryStringParser.parseCaller(context),
      filter,
      context.request.body,
    );

    context.response.status = HttpCode.NoContent;
  }
}
