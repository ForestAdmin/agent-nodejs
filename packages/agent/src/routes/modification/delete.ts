import { CompositeId, ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import CollectionRoute from '../collection-route';
import Data from '../../utils/data';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleListDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDelete.bind(this));
  }

  public async handleDelete(context: Context): Promise<void> {
    await this.services.permissions.can(context, `delete:${this.collection.name}`);

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    await this.deleteRecords(context, [id]);

    context.response.status = HttpCode.NoContent;
  }

  public async handleListDelete(context: Context): Promise<void> {
    const allRecordsMode = Data.parseAllRecordsMode(context);
    const ids = context.request.body?.data?.attributes?.ids;
    const unpackedIds = IdUtils.unpackIds(
      this.collection.schema,
      allRecordsMode.isActivated ? allRecordsMode.excludedIds : ids,
    );

    await this.deleteRecords(context, unpackedIds, allRecordsMode.isActivated);

    context.response.status = HttpCode.NoContent;
  }

  private async deleteRecords(
    context: Context,
    ids: CompositeId[],
    isRemoveAllRecords = false,
  ): Promise<void> {
    let selectedIds = ConditionTreeFactory.matchIds(this.collection.schema, ids);
    if (isRemoveAllRecords) selectedIds = selectedIds.inverse();

    const filter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.permissions.getScope(this.collection, context),
        selectedIds,
      ),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    await this.collection.delete(filter);
  }
}
