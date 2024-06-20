import { RecordData } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class RpcCreateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/rpc/${this.collectionUrlSlug}/create`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    await this.services.authorization.assertCanAdd(context, this.collection.name);

    const records = await this.collection.create(
      QueryStringParser.parseCaller(context),
      context.request.body as RecordData[],
    );

    context.response.body = records;
  }
}
