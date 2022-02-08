import { CompositeId, ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import CollectionRoute from '../collection-base-route';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class DeleteRoute extends CollectionRoute {
  override setupPrivateRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleListDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDelete.bind(this));
  }

  public async handleDelete(context: Context): Promise<void> {
    let id: CompositeId;

    try {
      id = IdUtils.unpackId(this.collection.schema, context.params.id);
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    await this.delete(context, [id]);
  }

  public async handleListDelete(context: Context): Promise<void> {
    const attributes = context.request.body?.data?.attributes;
    let unpackedIds: CompositeId[];
    let excludedRecordMode: boolean;

    try {
      excludedRecordMode = attributes?.all_records;
      unpackedIds = IdUtils.unpackIds(
        this.collection.schema,
        excludedRecordMode ? attributes?.all_records_ids_excluded : attributes?.ids,
      );
    } catch (e) {
      return context.throw(HttpCode.BadRequest, e.message);
    }

    await this.delete(context, unpackedIds, excludedRecordMode);
  }

  private async delete(
    context: Context,
    ids: CompositeId[],
    isRemoveAllRecords = false,
  ): Promise<void> {
    const filter = new Filter({
      conditionTree: QueryStringParser.parseConditionTree(this.collection, context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    try {
      const condition = ConditionTreeFactory.matchIds(this.collection.schema, ids);

      await this.collection.delete(
        filter.override({
          conditionTree: ConditionTreeFactory.intersect(
            filter.conditionTree,
            isRemoveAllRecords ? condition.inverse() : condition,
          ),
        }),
      );

      context.response.status = HttpCode.NoContent;
    } catch {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to delete the record(s) on the collection "${this.collection.name}"`,
      );
    }
  }
}
