import { CollectionUtils, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { Readable } from 'stream';
import ContextFilterFactory from '../../utils/context-filter-factory';
import CsvCommon from './csv-common';
import CsvGenerator from '../../../utils/csv-generator';
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
    await this.services.permissions.can(context, `browse:${this.collection.name}`);
    await this.services.permissions.can(context, `export:${this.collection.name}`);

    const { header } = context.request.query as Record<string, string>;
    CsvCommon.buildResponseContext(context);

    const projection = QueryStringParser.parseProjection(this.foreignCollection, context);
    const scope = await this.services.permissions.getScope(this.foreignCollection, context);
    const filter = ContextFilterFactory.buildPaginated(this.foreignCollection, context, scope);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

    const list = async (paginatedFilter: PaginatedFilter, projectionParam: Projection) =>
      CollectionUtils.listRelation(
        this.collection,
        parentId,
        this.relationName,
        paginatedFilter,
        projectionParam,
      );
    const gen = CsvGenerator.generate(projection, header, filter, this.foreignCollection, list);
    context.response.body = Readable.from(gen);
  }
}
