import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import CollectionRoute from '../collection-route';
import CsvCommon from './csv-common';
import CsvGenerator from '../../../utils/csv-generator';
import QueryStringParser from '../../utils/query-string';

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collection.name}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    const { header } = context.request.query as Record<string, string>;
    CsvCommon.buildResponseContext(context);

    const projection = QueryStringParser.parseProjection(this.collection, context);
    const scope = await this.services.permissions.getScope(this.collection, context);
    const filter = CsvCommon.buildFilter(context, this.collection, scope);

    const list = this.collection.list.bind(this.collection);
    const generator = CsvGenerator.generate(projection, header, filter, this.collection, list);
    context.response.body = Readable.from(generator);
  }
}
