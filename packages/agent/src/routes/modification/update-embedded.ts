import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import RelationRoute from '../relation-route';

export default class UpdateEmbedded extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,

      this.handleDissociateDeleteRelatedRoute.bind(this),
    );
  }

  public async handleDissociateDeleteRelatedRoute(context: Context): Promise<void> {
    context.response.status = HttpCode.Ok;
  }
}
