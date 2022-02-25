import { ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import CollectionRoute from '../collection-route';
import CsvGenerator from '../../utils/csv-generator';
import QueryStringParser from '../../utils/query-string';

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    const { query } = context.request;
    const projection = QueryStringParser.parseProjection(this.collection, context);
    const filter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.permissions.getScope(this.collection, context),
      ),
      search: QueryStringParser.parseSearch(this.collection, context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    context.response.type = 'text/csv; charset=utf-8';
    context.response.attachment(`attachment; filename=${query.filename}`);
    context.response.lastModified = new Date();
    context.response.set({ 'X-Accel-Buffering': 'no' });
    context.response.set({ 'Cache-Control': 'no-cache' });

    const header = query.header as string;
    const list = this.collection.list.bind(this.collection);
    const generator = CsvGenerator.generate(projection, header, filter, this.collection, list);
    context.response.body = Readable.from(generator);
  }
}
