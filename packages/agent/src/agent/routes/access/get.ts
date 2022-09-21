import {
  ConditionTreeFactory,
  PaginatedFilter,
  ProjectionFactory,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { CollectionActionEvent } from '../../services/authorization';
import { HttpCode } from '../../types';
import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class GetRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Read,
      this.collection.name,
    );

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        ConditionTreeFactory.matchIds(this.collection.schema, [id]),
        await this.services.authorization.getScope(this.collection, context),
      ),
    });

    const records = await this.collection.list(
      QueryStringParser.parseCaller(context),
      filter,
      ProjectionFactory.all(this.collection),
    );

    if (!records.length) {
      context.throw(HttpCode.NotFound, 'Record does not exists');
    }

    context.response.body = this.services.serializer.serialize(this.collection, records[0]);
  }
}
