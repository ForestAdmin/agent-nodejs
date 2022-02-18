import { Context } from 'koa';
import { RecordValidator } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';

export default class CreateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/${this.collection.name}`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    await this.services.permissions.can(context, `add:${this.collection.name}`);

    const rawRecord = this.services.serializer.deserialize(this.collection, context.request.body);
    RecordValidator.validate(this.collection, rawRecord);

    const [record] = await this.collection.create([rawRecord]);

    context.response.body = this.services.serializer.serialize(this.collection, record);
  }
}
