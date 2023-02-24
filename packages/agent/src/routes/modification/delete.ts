import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import ListFilterParser from '../../utils/query-parser/filter/list';
import SingleFilterParser from '../../utils/query-parser/filter/single';
import CollectionRoute from '../collection-route';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    const handler = this.handleDelete.bind(this);

    router.delete(`/${this.collection.name}`, handler);
    router.delete(`/${this.collection.name}/:id`, handler);
  }

  private async handleDelete(context: Context): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = context.params.id
      ? SingleFilterParser.fromCtx(this.collection, context)
      : ListFilterParser.fromCtx(this.collection, context);

    await this.collection.delete(caller, filter.intersectWith(scope));

    context.response.status = HttpCode.NoContent;
  }
}
