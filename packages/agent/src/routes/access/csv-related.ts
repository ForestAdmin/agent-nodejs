import type { Caller, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import { CollectionUtils } from '@forestadmin/datasource-toolkit';
import { Readable } from 'stream';

import ContextFilterFactory from '../../utils/context-filter-factory';
import CsvGenerator from '../../utils/csv-generator';
import CsvRouteContext from '../../utils/csv-route-context';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class CsvRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.get(
      `/${this.collectionUrlSlug}/:parentId/relationships/${this.relationUrlSlug}.csv`,
      this.handleRelatedCsv.bind(this),
    );
  }

  async handleRelatedCsv(context: Context): Promise<void> {
    await this.services.authorization.assertCanBrowse(context, this.foreignCollection.name);
    await this.services.authorization.assertCanExport(context, this.foreignCollection.name);
    await this.services.authorization.assertCanReadQueryFields(context, this.foreignCollection);

    const { header: requestedHeader } = context.request.query as Record<string, string>;

    const requested = QueryStringParser.parseProjectionFromHeaderOrQuery(
      this.foreignCollection,
      context,
    );
    const projection = await this.services.authorization.redactProjection(
      context,
      this.foreignCollection,
      requested,
    );
    const header = CsvGenerator.filterHeader(requestedHeader, requested.projection, projection);
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    const caller = QueryStringParser.parseCaller(context);
    const filter = ContextFilterFactory.buildPaginated(this.foreignCollection, context, scope);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const relationScopes = await this.services.authorization.getRelationScopes(
      context,
      this.foreignCollection,
      projection,
    );

    CsvRouteContext.buildResponse(context);

    const gen = CsvGenerator.generate(
      caller,
      projection,
      header,
      filter,
      this.options.limitExportSize,
      this.foreignCollection,
      async (cal: Caller, fil: PaginatedFilter, proj: Projection) =>
        relationScopes.redact(
          await CollectionUtils.listRelation(
            this.collection,
            parentId,
            this.relationName,
            cal,
            fil,
            relationScopes.withScopeFields(proj),
          ),
          proj,
          cal.timezone,
        ),
    );
    context.response.body = Readable.from(gen);
  }
}
