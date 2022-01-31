import { RecordData, RecordUtils } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import CollectionBaseRoute from '../collection-base-route';

export default class CreateRoute extends CollectionBaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.post(`/${this.collection.name}`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    let rawRecord: RecordData;

    try {
      rawRecord = this.services.serializer.deserialize(this.collection, context.request.body);
      RecordUtils.validate(this.collection, rawRecord);
    } catch (e) {
      return context.throw(400, e.message);
    }

    try {
      const [record] = await this.collection.create([rawRecord]);

      context.response.body = this.services.serializer.serialize(this.collection, record);
    } catch {
      context.throw(500, `Failed to create record on collection "${this.collection.name}"`);
    }
  }
}
