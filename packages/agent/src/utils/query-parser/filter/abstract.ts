import {
  Collection,
  ConditionTree,
  ConditionTreeValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import ConditionTreeParser from '../../condition-tree-parser';

/**
 * This class is responsible for making sense of the parameters sent by the client, and telling
 * the agent which records to fetch or modify.
 *
 * The protocol that is used between the frontend and the agent is quite inconsistent:
 * - There are 2 different ways to specify filters: see parseRecordSelection and parseUserFilter.
 * - Data is not always sent in the same place (body.data.attributes.all_records_subset_query,
 *   query, body, body.data)
 * - Naming can be inconsistent (filter vs filters)
 */
export default abstract class FilterParser {
  /** Extract user filters from request */
  protected static parseUserFilter(collection: Collection, context: Context): ConditionTree {
    try {
      const filters = this.getValue(context, 'filters') || this.getValue(context, 'filter');
      if (!filters) return null;

      const json = typeof filters === 'object' ? filters : JSON.parse(filters.toString());
      const conditionTree = ConditionTreeParser.fromPlainObject(collection, json);
      ConditionTreeValidator.validate(conditionTree, collection);

      return conditionTree;
    } catch (e) {
      throw new ValidationError(`Invalid filters (${e.message})`);
    }
  }

  protected static parseSearch(collection: Collection, context: Context): string {
    const search = this.getValue(context, 'search');

    if (search && !collection.schema.searchable) {
      throw new ValidationError(`Collection is not searchable`);
    }

    return search ?? null;
  }

  protected static parseSearchExtended(context: Context): boolean {
    const extended = this.getValue(context, 'searchExtended', '0');

    return !!extended && extended !== '0' && extended !== 'false';
  }

  protected static parseSegment(collection: Collection, context: Context): string {
    const segment = this.getValue(context, 'segment');

    if (segment && !collection.schema.segments.includes(segment))
      throw new ValidationError(`Invalid segment: "${segment}"`);

    return segment;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected static getValue(context: Context, name: string, fallback: string = null): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { query, body } = context.request as any;

    return (
      body?.data?.attributes?.all_records_subset_query?.[name] ??
      body?.[name] ??
      query?.[name] ??
      fallback
    );
  }
}
