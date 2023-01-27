import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import CollectionRoute from '../collection-route';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleListDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDelete.bind(this));
  }

  public async handleDelete(context: Context): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = FilterParser.one(this.collection, context).intersectWith(scope);

    await this.collection.delete(caller, filter);

    context.response.status = HttpCode.NoContent;
  }

  public async handleListDelete(context: Context): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = FilterParser.multiple(this.collection, context).intersectWith(scope);

    await this.collection.delete(caller, filter);

    context.response.status = HttpCode.NoContent;
  }
}
