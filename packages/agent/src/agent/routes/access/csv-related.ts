import {
  Caller,
  CollectionUtils,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { Readable } from 'stream';
import Router from '@koa/router';

import { CollectionActionEvent } from '../../utils/types';
import ContextFilterFactory from '../../utils/context-filter-factory';
import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class CsvRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}.csv`,
      this.handleRelatedCsv.bind(this),
    );
  }

  async handleRelatedCsv(context: Context): Promise<void> {
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Browse,
      this.collection.name,
    );
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Export,
      this.collection.name,
    );

    const { header } = context.request.query as Record<string, string>;
    CsvRouteContext.buildResponse(context);

    const projection = QueryStringParser.parseProjection(this.foreignCollection, context);
    const scope = await this.services.permissions.getScope(this.foreignCollection, context);
    const caller = QueryStringParser.parseCaller(context);
    const filter = ContextFilterFactory.buildPaginated(this.foreignCollection, context, scope);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

    const gen = CsvGenerator.generate(
      caller,
      projection,
      header,
      filter,
      this.foreignCollection,
      async (cal: Caller, fil: PaginatedFilter, proj: Projection) =>
        CollectionUtils.listRelation(this.collection, parentId, this.relationName, cal, fil, proj),
    );
    context.response.body = Readable.from(gen);
  }
}
