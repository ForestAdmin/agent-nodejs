import {
  ConditionTreeFactory,
  Filter,
  ProjectionFactory,
  RecordValidator,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { CollectionActionEvent } from '../../services/authorization';
import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class UpdateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(`/${this.collection.name}/:id`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context): Promise<void> {
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Edit,
      this.collection.name,
    );

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);

    const { body } = context.request;

    if ('relationships' in body.data) {
      delete body.data.relationships;
    }

    const record = this.services.serializer.deserialize(this.collection, body);
    RecordValidator.validate(this.collection, record);

    const conditionTree = ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(this.collection.schema, [id]),
      await this.services.authorization.getScope(this.collection, context),
    );
    const caller = QueryStringParser.parseCaller(context);
    await this.collection.update(caller, new Filter({ conditionTree }), record);
    const [updateResult] = await this.collection.list(
      caller,
      new Filter({ conditionTree }),
      ProjectionFactory.all(this.collection),
    );

    context.response.body = this.services.serializer.serialize(this.collection, updateResult);
  }
}
