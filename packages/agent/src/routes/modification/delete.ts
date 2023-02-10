import { Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import CollectionRoute from '../collection-route';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDelete.bind(this));
  }

  private async handleDelete(context: Context): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = context.params.id
      ? FilterParser.one(this.collection, context)
      : FilterParser.multiple(this.collection, context);

    await this.collection.delete(caller, filter.intersectWith(scope));

    context.response.status = HttpCode.NoContent;
  }
}
