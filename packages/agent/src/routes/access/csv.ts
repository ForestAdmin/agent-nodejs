import Router from '@koa/router';
import { Context } from 'koa';
import { Readable } from 'stream';

import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import ProjectionParser from '../../utils/query-parser/projection';
import CollectionRoute from '../collection-route';

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);
    await this.services.authorization.assertCanExport(context, this.collection.name);

    const { header } = context.request.query as Record<string, string>;
    CsvRouteContext.buildResponse(context);

    const scope = await this.services.authorization.getScope(this.collection, context);

    const caller = CallerParser.fromCtx(context);
    const filter = FilterParser.multiple(this.collection, context).intersectWith(scope);
    const projection = ProjectionParser.fromCtx(this.collection, context);

    const list = this.collection.list.bind(this.collection);
    const gen = CsvGenerator.generate(caller, projection, header, filter, this.collection, list);
    context.response.body = Readable.from(gen);
  }
}
