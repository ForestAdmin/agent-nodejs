import { Context } from 'koa';
import { ManyToOneSchema, OneToOneSchema } from '@forestadmin/datasource-toolkit';
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
    const data = context.request.body?.data;
    const relation = this.collection.schema.fields[data.type] as ManyToOneSchema | OneToOneSchema;

    const filter = await this.collection.update(filter, { [relation.foreignKey]: data.ip });

    context.response.status = HttpCode.Ok;
  }
}
