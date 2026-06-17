import type Router from '@koa/router';
import type { Context } from 'koa';

import CollectionRoute from '../collection-route';

export default class AuditTrailRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/_audit-trail/${this.collectionUrlSlug}/:id`, this.handleHistory.bind(this));
  }

  public async handleHistory(context: Context): Promise<void> {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const { store } = this.options.auditTrail;
    // context.params.id is already Forest's packed id, the form the audit store keys on.
    const history = await store.listByRecord({
      collection: this.collection.name,
      recordId: context.params.id,
    });

    context.response.body = { data: history };
  }
}
