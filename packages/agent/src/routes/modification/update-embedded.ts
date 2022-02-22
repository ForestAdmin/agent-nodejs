import { ConditionTreeFactory, Filter, SchemaUtils } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import RelationRoute from '../relation-route';

export default class UpdateEmbedded extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,

      this.handleUpdateEmbeddedRoute.bind(this),
    );
  }

  public async handleUpdateEmbeddedRoute(context: Context): Promise<void> {
    await this.services.permissions.can(context, `edit:${this.collection.name}`);

    const data = context.request.body?.data;

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const newId = IdUtils.unpackId(this.foreignCollection.schema, data.id);
    const foreignKey = SchemaUtils.getForeignKeyName(this.collection.schema, data.type);

    const conditionTree = ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(this.collection.schema, [parentId]),
      await this.services.permissions.getScope(this.collection, context),
    );

    await this.collection.update(new Filter({ conditionTree }), { [foreignKey]: newId });
    context.response.status = HttpCode.NoContent;
  }
}
