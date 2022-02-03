import { CompositeId, ConditionTreeUtils, Filter } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-base-route';

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
    let unpackedIds: CompositeId[];
    let excludedRecordMode: boolean;

    try {
      const { ids, all_records_ids_excluded: excludedIds } = context.request.body.data.attributes;
      excludedRecordMode = context.request.body.data.attributes.all_records;

      if (excludedRecordMode) {
        unpackedIds = IdUtils.unpackIds(this.collection.schema, excludedIds);
      } else {
        unpackedIds = IdUtils.unpackIds(this.collection.schema, ids);
      }
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
    const condition = ConditionTreeUtils.matchIds(this.collection.schema, ids);
    const filter = new Filter({
      conditionTree: isRemoveAllRecords ? condition.inverse() : condition,
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    try {
      await this.collection.delete(filter);

      context.response.status = HttpCode.NoContent;
    } catch {
      context.throw(
        HttpCode.InternalServerError,
        `Failed to delete the record(s) on the collection "${this.collection.name}"`,
      );
    }
  }
}
