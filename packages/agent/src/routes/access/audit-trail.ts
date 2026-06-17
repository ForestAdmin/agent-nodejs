import type Router from '@koa/router';
import type { Context } from 'koa';

import IdUtils from '../../utils/id';
import CollectionRoute from '../collection-route';

export default class AuditTrailRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/_audit-trail/${this.collectionUrlSlug}/:id`, this.handleHistory.bind(this));
  }

  public async handleHistory(context: Context): Promise<void> {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const { store } = this.options.auditTrail;
    const recordId = IdUtils.unpackId(this.collection.schema, context.params.id);
    const history = await store.listByRecord({ collection: this.collection.name, recordId });

    context.response.body = { data: history };
  }
}
