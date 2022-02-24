import { ConditionTreeFactory, Filter } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import CollectionRoute from '../collection-route';
import QueryStringParser from '../../utils/query-string';

export default abstract class BaseActionRoute extends CollectionRoute {
  protected async getRecordSelection(context: Context): Promise<Filter> {
    const conditionTree = ConditionTreeFactory.intersect(
      QueryStringParser.parseRecordSelection(this.collection, context),
      QueryStringParser.parseConditionTree(this.collection, context),
      await this.services.permissions.getScope(this.collection, context),
    );

    const filter = new Filter({
      conditionTree,
      search: QueryStringParser.parseSearch(this.collection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    return filter;
  }
}
