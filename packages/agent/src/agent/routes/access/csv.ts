import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';
import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import QueryStringParser from '../../utils/query-string';

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    await this.services.permissions.can(context, `read:${this.collection.name}`);
    await this.services.permissions.can(context, `export:${this.collection.name}`);

    const { header } = context.request.query as Record<string, string>;
    CsvRouteContext.buildResponse(context);

    const projection = QueryStringParser.parseProjection(this.collection, context);
    const scope = await this.services.permissions.getScope(this.collection, context);
    const caller = QueryStringParser.parseRecipient(context);
    const filter = ContextFilterFactory.buildPaginated(this.collection, context, scope);

    const list = this.collection.list.bind(this.collection);
    const gen = CsvGenerator.generate(caller, projection, header, filter, this.collection, list);
    context.response.body = Readable.from(gen);
  }
}
