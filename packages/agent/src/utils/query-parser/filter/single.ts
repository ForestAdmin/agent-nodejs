import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Page,
  PaginatedFilter,
  SortFactory,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import FilterParser from './abstract';
import IdUtils from '../../id';

export default class SingleFilterParser extends FilterParser {
  static fromCtx(collection: Collection, context: Context): PaginatedFilter {
    return new PaginatedFilter({
      conditionTree: this.parseId(collection, context),
      page: new Page(0, 1),
      sort: SortFactory.byPrimaryKeys(collection),
    });
  }

  /** Extract id from request params */
  protected static parseId(collection: Collection, context: Context): ConditionTree {
    if (!context.params.id) return null;

    return ConditionTreeFactory.matchIds(collection.schema, [
      IdUtils.unpackId(collection.schema, context.params.id),
    ]);
  }
}
