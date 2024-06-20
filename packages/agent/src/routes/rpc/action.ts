import { ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class RpcActionRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/rpc/${this.collectionUrlSlug}/action-execute`, this.handleExecute.bind(this));
    router.post(`/rpc/${this.collectionUrlSlug}/action-form`, this.handleForm.bind(this));
  }

  public async handleExecute(context: Context) {
    const action = context.query.action as string;
    const queryFilter = JSON.parse(context.query.filter as string);

    const filter = new Filter({
      ...queryFilter,
      conditionTree: queryFilter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(queryFilter.conditionTree)
        : undefined,
    });

    const actionResult = await this.collection.execute(
      QueryStringParser.parseCaller(context),
      action,
      context.request.body,
      filter,
    );

    // TODO action with file

    context.response.body = {
      ...actionResult,
      invalidated: actionResult.type === 'Success' ? Array.from(actionResult.invalidated) : [],
    };
  }

  public async handleForm(context: Context) {
    const action = context.query.action as string;
    const queryFilter = JSON.parse(context.query.filter as string);
    const metas = JSON.parse(context.query.metas as string);

    const filter = new Filter({
      ...queryFilter,
      conditionTree: queryFilter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(queryFilter.conditionTree)
        : undefined,
    });

    const actionFields = await this.collection.getForm(
      QueryStringParser.parseCaller(context),
      action,
      context.request.body,
      filter,
      metas,
    );

    context.response.body = actionFields;
  }
}
