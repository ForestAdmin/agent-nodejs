import {
  ConditionTreeFactory,
  Filter,
  Projection,
  RecordValidator,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';

export default class UpdateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(`/${this.collection.name}/:id`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context): Promise<void> {
    await this.services.permissions.can(context, `edit:${this.collection.name}`);

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);

    const { body } = context.request;

    if ('relationships' in body.data) {
      delete body.data.relationships;
    }

    const record = this.services.serializer.deserialize(this.collection, body);
    RecordValidator.validate(this.collection, record);

    const conditionTree = ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(this.collection.schema, [id]),
      await this.services.permissions.getScope(this.collection, context),
    );

    await this.collection.update(new Filter({ conditionTree }), record);
    const [updateResult] = await this.collection.list(
      new Filter({ conditionTree }),
      new Projection(...Object.keys(this.collection.schema.fields)),
    );

    context.response.body = this.services.serializer.serialize(this.collection, updateResult);
  }
}
