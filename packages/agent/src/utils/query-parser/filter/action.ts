import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
  FilterFactory,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import FilterParser from './abstract';
import IdUtils from '../../id';
import CallerParser from '../caller';

export default class ActionFilterParser extends FilterParser {
  static async fromCtx(collection: Collection, context: Context): Promise<Filter> {
    let filter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        this.parseRecordSelection(collection, context),
        this.parseUserFilter(collection, context),
      ),
      search: this.parseSearch(collection, context),
      searchExtended: this.parseSearchExtended(context),
      segment: this.parseSegment(collection, context),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes = (context.request.body as any)?.data?.attributes;

    // Restrict the filter further for the "related data" page.
    if (attributes?.parent_association_name) {
      const caller = CallerParser.fromCtx(context);
      const relation = attributes?.parent_association_name;
      const parent = collection.dataSource.getCollection(attributes.parent_collection_name);
      const parentId = IdUtils.unpackId(parent.schema, attributes.parent_collection_id);

      filter = await FilterFactory.makeForeignFilter(parent, parentId, relation, caller, filter);
    }

    return filter;
  }

  /** Extract bulk action id selection */
  protected static parseRecordSelection(collection: Collection, context: Context): ConditionTree {
    const body = context.request.body as any; // eslint-disable-line @typescript-eslint/no-explicit-any,max-len
    const data = body?.data;
    const attributes = data?.attributes;
    const areExcluded = Boolean(attributes?.all_records);
    let ids = attributes?.ids || (Array.isArray(data) && data.map(r => r.id)) || undefined;

    ids = IdUtils.unpackIds(
      collection.schema,
      areExcluded ? attributes?.all_records_ids_excluded : ids,
    );

    let selectedIds = ConditionTreeFactory.matchIds(collection.schema, ids);
    if (areExcluded) selectedIds = selectedIds.inverse();

    return selectedIds;
  }
}
