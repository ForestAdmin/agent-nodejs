import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeValidator,
  Filter,
  FilterFactory,
  Page,
  PaginatedFilter,
  Sort,
  SortFactory,
  SortValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import CallerParser from './caller';
import ConditionTreeConverter from '../condition-tree-converter';
import IdUtils from '../id';

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
export default class FilterParser {
  static one(collection: Collection, context: Context): PaginatedFilter {
    return new PaginatedFilter({
      conditionTree: this.parseId(collection, context),
      page: new Page(0, 1),
      sort: SortFactory.byPrimaryKeys(collection),
    });
  }

  static multiple(collection: Collection, context: Context): PaginatedFilter {
    return new PaginatedFilter({
      conditionTree: this.parseUserFilter(collection, context),
      search: this.parseSearch(collection, context),
      searchExtended: this.parseSearchExtended(context),
      segment: this.parseSegment(collection, context),
      page: this.parsePagination(context),
      sort: this.parseSort(collection, context),
    });
  }

  static async action(collection: Collection, context: Context): Promise<Filter> {
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

  /** Extract id from request params */
  private static parseId(collection: Collection, context: Context): ConditionTree {
    if (!context.params.id) return null;

    return ConditionTreeFactory.matchIds(collection.schema, [
      IdUtils.unpackId(collection.schema, context.params.id),
    ]);
  }

  /** Extract bulk action id selection */
  private static parseRecordSelection(collection: Collection, context: Context): ConditionTree {
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

  /** Extract user filters from request */
  private static parseUserFilter(collection: Collection, context: Context): ConditionTree {
    try {
      const filters = this.getValue(context, 'filters') || this.getValue(context, 'filter');
      if (!filters) return null;

      const json = typeof filters === 'object' ? filters : JSON.parse(filters.toString());
      const conditionTree = ConditionTreeConverter.fromPlainObject(collection, json);
      ConditionTreeValidator.validate(conditionTree, collection);

      return conditionTree;
    } catch (e) {
      throw new ValidationError(`Invalid filters (${e.message})`);
    }
  }

  private static parseSearch(collection: Collection, context: Context): string {
    const search = this.getValue(context, 'search');

    if (search && !collection.schema.searchable) {
      throw new ValidationError(`Collection is not searchable`);
    }

    return search ?? null;
  }

  private static parseSearchExtended(context: Context): boolean {
    const extended = this.getValue(context, 'searchExtended', '0');

    return !!extended && extended !== '0' && extended !== 'false';
  }

  private static parseSegment(collection: Collection, context: Context): string {
    const segment = this.getValue(context, 'segment');

    if (segment && !collection.schema.segments.includes(segment))
      throw new ValidationError(`Invalid segment: "${segment}"`);

    return segment;
  }

  private static parsePagination(context: Context): Page {
    const queryItemsPerPage = this.getValue(context, 'page[size]', '15');
    const queryPageToSkip = this.getValue(context, 'page[number]', '1');
    const itemsPerPage = Number.parseInt(queryItemsPerPage, 10);
    const pageToSkip = Number.parseInt(queryPageToSkip, 10);

    if (
      Number.isNaN(itemsPerPage) ||
      Number.isNaN(pageToSkip) ||
      itemsPerPage <= 0 ||
      pageToSkip <= 0
    ) {
      throw new ValidationError(`Invalid pagination [limit: ${itemsPerPage}, skip: ${pageToSkip}]`);
    }

    return new Page(pageToSkip * itemsPerPage, itemsPerPage);
  }

  private static parseSort(collection: Collection, context: Context): Sort {
    const sortString = this.getValue(context, 'sort');

    try {
      if (!sortString) return SortFactory.byPrimaryKeys(collection);

      const sort = new Sort({
        field: sortString.replace(/^-/, '').replace('.', ':'),
        ascending: !sortString.startsWith('-'),
      });

      SortValidator.validate(collection, sort);

      return sort;
    } catch {
      throw new ValidationError(`Invalid sort: ${sortString}`);
    }
  }

  private static getValue(context: Context, name: string, fallback: string = null): any {
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
