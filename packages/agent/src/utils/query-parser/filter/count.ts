import { Collection, Filter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import FilterParser from './abstract';

export default class CountFilterParser extends FilterParser {
  static fromCtx(collection: Collection, context: Context): Filter {
    return new Filter({
      conditionTree: this.parseUserFilter(collection, context),
      search: this.parseSearch(collection, context),
      searchExtended: this.parseSearchExtended(context),
      segment: this.parseSegment(collection, context),
    });
  }
}
