import { ProjectionFactory } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import CollectionRoute from '../collection-route';

export default class GetRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const scope = await this.services.authorization.getScope(this.collection, context);
    const records = await this.collection.list(
      CallerParser.fromCtx(context),
      FilterParser.one(this.collection, context).intersectWith(scope),
      ProjectionFactory.all(this.collection),
    );

    if (!records.length) {
      context.throw(HttpCode.NotFound, 'Record does not exists');
    }

    context.response.body = this.services.serializer.serialize(this.collection, records[0]);
  }
}
