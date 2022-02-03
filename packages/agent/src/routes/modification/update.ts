import {
  Filter,
  ConditionTreeUtils,
  RecordUtils,
  CompositeId,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import CollectionRoute from '../collection-base-route';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';

export default class UpdateRoute extends CollectionRoute {
  override setupPrivateRoutes(router: Router): void {
    router.put(`/${this.collection.name}/:id`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context): Promise<void> {
    let id: CompositeId;
    let record: RecordData;

    try {
      id = IdUtils.unpackId(this.collection.schema, context.params.id);
      record = this.services.serializer.deserialize(this.collection, context.request.body);
      RecordUtils.validate(this.collection, record);
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    try {
      const conditionTree = ConditionTreeUtils.matchIds(this.collection.schema, [id]);
      await this.collection.update(new Filter({ conditionTree }), record);

      context.response.status = HttpCode.NoContent;
    } catch {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to update the record on the collection "${this.collection.name}"`,
      );
    }
  }
}
