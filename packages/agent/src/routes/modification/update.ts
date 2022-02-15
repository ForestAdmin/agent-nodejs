import { ConditionTreeFactory, Filter, RecordValidator } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode, RouteType } from '../../types';
import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';

export default class UpdateRoute extends CollectionRoute {
  type = RouteType.PrivateRoute;

  setupRoutes(router: Router): void {
    router.put(`/${this.collection.name}/:id`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context): Promise<void> {
    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    const record = this.services.serializer.deserialize(this.collection, context.request.body);
    RecordValidator.validate(this.collection, record);

    const conditionTree = ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(this.collection.schema, [id]),
      await this.services.scope.getConditionTree(this.collection, context),
    );

    await this.collection.update(new Filter({ conditionTree }), record);
    context.response.status = HttpCode.NoContent;
  }
}
