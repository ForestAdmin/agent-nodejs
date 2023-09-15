import { CollectionUtils } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class ListRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleListRelated.bind(this),
    );
  }

  public async handleListRelated(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.foreignCollection.name);

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    const paginatedFilter = ContextFilterFactory.buildPaginated(
      this.foreignCollection,
      context,
      scope,
    );

    const records = await CollectionUtils.listRelation(
      this.collection,
      parentId,
      this.relationName,
      QueryStringParser.parseCaller(context),
      paginatedFilter,
      QueryStringParser.parseProjectionWithPks(this.foreignCollection, context),
    );

    context.response.body = this.services.serializer.serializeWithSearchMetadata(
      this.foreignCollection,
      records,
      paginatedFilter.search,
    );
  }
}
