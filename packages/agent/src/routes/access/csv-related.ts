import {
  CollectionUtils,
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import CsvGenerator from '../../utils/csv-generator';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class ListRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}.csv`,
      this.handleRelatedCsv.bind(this),
    );
  }

  async handleRelatedCsv(context: Context): Promise<void> {
    const { query } = context.request;
    const projection = QueryStringParser.parseProjection(this.foreignCollection, context);
    const filter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.permissions.getScope(this.foreignCollection, context),
      ),
      search: QueryStringParser.parseSearch(this.foreignCollection, context),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

    context.response.type = 'text/csv; charset=utf-8';
    context.response.attachment(`attachment; filename=${query.filename}`);
    context.response.lastModified = new Date();
    context.response.set({ 'X-Accel-Buffering': 'no' });
    context.response.set({ 'Cache-Control': 'no-cache' });

    const list = async (paginatedFilter: PaginatedFilter, projectionParam: Projection) =>
      CollectionUtils.listRelation(
        this.collection,
        parentId,
        this.relationName,
        paginatedFilter,
        projectionParam,
      );
    const header = query.header as string;
    const gen = CsvGenerator.generate(projection, header, filter, this.foreignCollection, list);
    context.response.body = Readable.from(gen);
  }
}
