import { CollectionUtils } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import ProjectionParser from '../../utils/query-parser/projection';
import RelationRoute from '../relation-route';

export default class ListRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleListRelated.bind(this),
    );
  }

  public async handleListRelated(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    const filter = FilterParser.fromList(this.foreignCollection, context).intersectWith(scope);

    const records = await CollectionUtils.listRelation(
      this.collection,
      parentId,
      this.relationName,
      CallerParser.fromCtx(context),
      filter,
      ProjectionParser.fromCtx(this.foreignCollection, context).withPks(this.foreignCollection),
    );

    context.response.body = this.services.serializer.serializeWithSearchMetadata(
      this.foreignCollection,
      records,
      filter.search,
    );
  }
}
