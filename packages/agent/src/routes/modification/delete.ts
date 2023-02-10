import { Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import CollectionRoute from '../collection-route';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleListDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDeleteOne.bind(this));
  }

  async handleDeleteOne(context: Context): Promise<void> {
    return this.handleDelete(context, FilterParser.one(this.collection, context));
  }

  async handleListDelete(context: Context): Promise<void> {
    return this.handleDelete(context, FilterParser.multiple(this.collection, context));
  }

  private async handleDelete(context: Context, filter: Filter): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);

    await this.collection.delete(caller, filter.intersectWith(scope));

    context.response.status = HttpCode.NoContent;
  }
}
