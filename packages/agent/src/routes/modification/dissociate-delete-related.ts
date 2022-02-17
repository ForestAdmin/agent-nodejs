import { Context } from 'koa';
import Router from '@koa/router';

import DeleteRelated from './delete-related';
import DissociateRelated from './dissociate-related';
import RelationRoute from '../relation-route';

export default class DissociateDeleteRelatedRoute extends RelationRoute {
  override setupPrivateRoutes(router: Router): void {
    router.delete(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,

      this.handleDissociateDeleteRelatedRoute.bind(this),
    );
  }

  public async handleDissociateDeleteRelatedRoute(context: Context): Promise<void> {
    const isDelete = Boolean(context.request.query.delete);

    if (isDelete) {
      return new DeleteRelated(
        this.services,
        this.collection,
        this.foreignCollection,
        this.relationName,
      ).handleDeleteRelatedRoute(context);
    }

    return new DissociateRelated(
      this.services,
      this.collection,
      this.foreignCollection,
      this.relationName,
    ).handleDissociateRelatedRoute(context);
  }
}
