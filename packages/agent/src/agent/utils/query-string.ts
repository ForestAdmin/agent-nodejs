import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeValidator,
  Page,
  Projection,
  ProjectionFactory,
  ProjectionValidator,
  QueryRecipient,
  Sort,
  SortFactory,
  SortValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

const DEFAULT_ITEMS_PER_PAGE = 15;
const DEFAULT_PAGE_TO_SKIP = 1;

export default class QueryStringParser {
  static parseConditionTree(collection: Collection, context: Context): ConditionTree {
    try {
      const filters =
        context.request.body?.data?.attributes?.all_records_subset_query?.filters ??
        context.request.body?.filters ??
        context.request.query?.filters;

      if (!filters) return null;

      const json = JSON.parse(filters.toString());
      const conditionTree = ConditionTreeFactory.fromPlainObject(json);
      ConditionTreeValidator.validate(conditionTree, collection);

      return conditionTree;
    } catch (e) {
      throw new ValidationError(`Invalid filters (${e.message})`);
    }
  }

  static parseProjection(collection: Collection, context: Context): Projection {
    try {
      const fields = context.request.query[`fields[${collection.name}]`];

      if (fields === '' || fields === undefined) {
        return ProjectionFactory.all(collection);
      }

      const rootFields = fields.toString().split(',');
      const explicitRequest = rootFields.map(field => {
        const schema = collection.schema.fields[field];

        return schema.type === 'Column'
          ? field
          : `${field}:${context.request.query[`fields[${field}]`]}`;
      });

      ProjectionValidator.validate(collection, explicitRequest);

      return new Projection(...explicitRequest);
    } catch (e) {
      throw new ValidationError(`Invalid projection`);
    }
  }

  static parseProjectionWithPks(collection: Collection, context: Context): Projection {
    const projection = QueryStringParser.parseProjection(collection, context);

    // Primary keys are not explicitly listed in the projections that the frontend
    // is sending, but are still required for the frontend to work.
    return projection.withPks(collection);
  }

  static parseSearch(collection: Collection, context: Context): string {
    const search =
      context.request.body?.data?.attributes?.all_records_subset_query?.search?.toString() ??
      context.request.query.search?.toString();

    if (search && !collection.schema.searchable) {
      throw new ValidationError(`Collection is not searchable`);
    }

    return search ?? null;
  }

  static parseSearchExtended(context: Context): boolean {
    const { request } = context;
    const extended =
      request.body?.data?.attributes?.all_records_subset_query?.searchExtended?.toString() ??
      request.query.searchExtended?.toString();

    return !!extended && extended !== '0' && extended !== 'false';
  }

  static parseSegment(collection: Collection, context: Context): string {
    const segment =
      context.request.body?.data?.attributes?.all_records_subset_query?.segment?.toString() ??
      context.request.query.segment?.toString();

    if (!segment) {
      return null;
    }

    if (!collection.schema.segments.includes(segment)) {
      throw new ValidationError(`Invalid segment: "${segment}"`);
    }

    return segment;
  }

  static parseRecipient(context: Context): QueryRecipient {
    const timezone = context.request.query.timezone?.toString();

    if (!timezone) {
      throw new ValidationError('Missing timezone');
    }

    // This is a method to validate a timezone using node only
    // @see https://stackoverflow.com/questions/44115681
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
      throw new Error('Time zones are not available in this environment');
    }

    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new ValidationError(`Invalid timezone: "${timezone}"`);
    }

    return { ...context.state.user, timezone };
  }

  static parsePagination(context: Context): Page {
    const queryItemsPerPage = (
      context.request.body?.data?.attributes?.all_records_subset_query?.['page[size]'] ??
      context.request.query['page[size]'] ??
      DEFAULT_ITEMS_PER_PAGE
    ).toString();
    const queryPageToSkip = (
      context.request.body?.data?.attributes?.all_records_subset_query?.['page[number]'] ??
      context.request.query['page[number]'] ??
      DEFAULT_PAGE_TO_SKIP
    ).toString();

    const itemsPerPage = Number.parseInt(queryItemsPerPage, 10);
    let pageToSkip = Number.parseInt(queryPageToSkip, 10);

    if (
      Number.isNaN(itemsPerPage) ||
      Number.isNaN(pageToSkip) ||
      itemsPerPage <= 0 ||
      pageToSkip <= 0
    ) {
      throw new ValidationError(`Invalid pagination [limit: ${itemsPerPage}, skip: ${pageToSkip}]`);
    }

    pageToSkip = Math.max(pageToSkip - 1, 0);
    pageToSkip *= itemsPerPage;

    return new Page(pageToSkip, itemsPerPage);
  }

  static parseSort(collection: Collection, context: Context): Sort {
    const sortString =
      context.request.body?.data?.attributes?.all_records_subset_query?.sort?.toString() ??
      context.request.query.sort?.toString();

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
}
