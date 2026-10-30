import type { Caller, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import { Readable } from 'stream';

import ContextFilterFactory from '../../utils/context-filter-factory';
import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class CsvRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/${this.collectionUrlSlug}.csv`, this.handleCsv.bind(this));
  }

  async handleCsv(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);
    await this.services.authorization.assertCanExport(context, this.collection.name);
    await this.services.authorization.assertCanReadQueryFields(context, this.collection);

    const { header: requestedHeader } = context.request.query as Record<string, string>;

    const requested = QueryStringParser.parseProjectionFromHeaderOrQuery(this.collection, context);
    const projection = await this.services.authorization.redactProjection(
      context,
      this.collection,
      requested,
    );
    const header = CsvGenerator.filterHeader(requestedHeader, requested.projection, projection);
    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = QueryStringParser.parseCaller(context);
    const filter = ContextFilterFactory.buildPaginated(this.collection, context, scope);
    const relationScopes = await this.services.authorization.getRelationScopes(
      context,
      this.collection,
      projection,
    );

    CsvRouteContext.buildResponse(context);

    const list = async (cal: Caller, fil: PaginatedFilter, proj: Projection) =>
      relationScopes.redact(
        await this.collection.list(cal, fil, relationScopes.withScopeFields(proj)),
        proj,
        cal.timezone,
      );

    const gen = CsvGenerator.generate(
      caller,
      projection,
      header,
      filter,
      this.options.limitExportSize,
      this.collection,
      list,
    );
    context.response.body = Readable.from(gen);
  }
}
