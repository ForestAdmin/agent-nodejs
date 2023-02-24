import {
  Caller,
  CollectionUtils,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import { Readable } from 'stream';

import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import ListFilterParser from '../../utils/query-parser/filter/list';
import ProjectionParser from '../../utils/query-parser/projection';
import RelationRoute from '../relation-route';

export default class CsvRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}.csv`,
      this.handleRelatedCsv.bind(this),
    );
  }

  async handleRelatedCsv(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);
    await this.services.authorization.assertCanExport(context, this.collection.name);

    const { header } = context.request.query as Record<string, string>;
    CsvRouteContext.buildResponse(context);

    const scope = await this.services.authorization.getScope(this.foreignCollection, context);

    const caller = CallerParser.fromCtx(context);
    const projection = ProjectionParser.fromCtx(this.foreignCollection, context);
    const filter = ListFilterParser.fromCtx(this.foreignCollection, context).intersectWith(scope);
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
