<<<<<<< HEAD
import {
  ConditionTreeFactory,
  Filter,
  ProjectionFactory,
  RecordData,
  RecordValidator,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
=======
import { ProjectionFactory, RecordValidator } from '@forestadmin/datasource-toolkit';
>>>>>>> 862b994b (refactor(agent): query parser)
import Router from '@koa/router';
import { Context } from 'koa';

import CallerParser from '../../utils/query-parser/caller';
import ListFilterParser from '../../utils/query-parser/filter/list';
import CollectionRoute from '../collection-route';

export default class UpdateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(`/${this.collection.name}/:id`, this.handleUpdate.bind(this));
  }

  public async handleUpdate(context: Context): Promise<void> {
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    // Deserialize the record.
    const record = this.deserializeForUpdate(context.request.body);

    const scope = await this.services.authorization.getScope(this.collection, context);

    const caller = CallerParser.fromCtx(context);
    const filter = ListFilterParser.fromCtx(this.collection, context).intersectWith(scope);
    await this.collection.update(caller, filter, record);

    const [updateResult] = await this.collection.list(
      caller,
      filter,
      ProjectionFactory.all(this.collection),
    );

    context.response.body = this.services.serializer.serialize(this.collection, updateResult);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deserializeForUpdate(body: any): RecordData {
    // We could update both relationships and attributes in the same request as ember-data
    // provides all needed information in the request body.

    // However, the frontend is making a second request to update relationships (not sure why)
    // so we purposely ignore the relationships in this request.
    if ('relationships' in body.data) {
      delete body.data.relationships;
    }

    // Deserialize the record.
    const record = this.services.serializer.deserialize(this.collection, body);

    // Validate the record.
    RecordValidator.validate(this.collection, record);

    // The deserializer will set the primary keys reading the JSON-API field `data.id`, regardless
    // of it being present in the attributes or not.

    // This is a no-op in most cases (as we'll be setting the primary key to the same value it
    // had), but can lead to errors when the primary key is read-only.
    for (const name of SchemaUtils.getPrimaryKeys(this.collection.schema)) {
      if (record[name] !== undefined && body.data.attributes[name] === undefined) {
        delete record[name];
      }
    }

    return record;
  }
}
