/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeValidator,
  Page,
  Projection,
  ProjectionFactory,
  ProjectionValidator,
  SchemaUtils,
  Sort,
  SortFactory,
  SortValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { v4 as uuidv4 } from 'uuid';

import ConditionTreeParser from './condition-tree-parser';

const DEFAULT_ITEMS_PER_PAGE = 15;
const DEFAULT_PAGE_TO_SKIP = 1;

export default class QueryStringParser {
  private static VALID_TIMEZONES = new Set<string>();

  static parseConditionTree(collection: Collection, context: Context): ConditionTree {
    const { query, body } = context.request as any;

    try {
      const filters =
        body?.data?.attributes?.all_records_subset_query?.filters ??
        body?.filters ??
        body?.filter ??
        query?.filters;

      if (!filters) return null;

      const json = typeof filters === 'object' ? filters : JSON.parse(filters.toString());
      const conditionTree = ConditionTreeParser.fromPlainObject(collection, json);
      ConditionTreeValidator.validate(conditionTree, collection);

      return conditionTree;
    } catch (e) {
      throw new ValidationError(`Invalid filters (${e.message})`);
    }
  }

  static parseProjection(collection: Collection, context: Context): Projection {
    try {
      const fields = context.request.query[`fields[${collection.name}]`];
      if (fields === '' || fields === undefined) return ProjectionFactory.all(collection);

      const { schema } = collection;
      const rootFields = fields.toString().split(',');
      const explicitRequest = rootFields.map(field => {
        const columnOrRelation = SchemaUtils.getField(schema, field, collection.name);

        return columnOrRelation.type === 'Column'
          ? field
          : `${field}:${context.request.query[`fields[${field}]`]}`;
      });

      ProjectionValidator.validate(collection, explicitRequest);

      return new Projection(...explicitRequest);
    } catch (e) {
      throw new ValidationError(`Invalid projection: ${e.message}`);
    }
  }

  static parseProjectionWithPks(collection: Collection, context: Context): Projection {
    const projection = QueryStringParser.parseProjection(collection, context);

    // Primary keys are not explicitly listed in the projections that the frontend
    // is sending, but are still required for the frontend to work.
    return projection.withPks(collection);
  }

  static parseSearch(collection: Collection, context: Context): string {
    const { query, body } = context.request as any;
    const search =
      body?.data?.attributes?.all_records_subset_query?.search?.toString() ??
      query.search?.toString();

    if (search && !collection.schema.searchable) {
      throw new ValidationError(`Collection is not searchable`);
    }

    return search ?? null;
  }

  static parseSearchExtended(context: Context): boolean {
    const { query, body } = context.request as any;
    const extended =
      body?.data?.attributes?.all_records_subset_query?.searchExtended?.toString() ??
      query.searchExtended?.toString();

    return !!extended && extended !== '0' && extended !== 'false';
  }

  static parseSegment(collection: Collection, context: Context): string {
    const { query, body } = context.request as any;
    const segment =
      body?.data?.attributes?.all_records_subset_query?.segment?.toString() ??
      query.segment?.toString();

    if (!segment) {
      return null;
    }

    if (!collection.schema.segments.includes(segment)) {
      throw new ValidationError(`Invalid segment: "${segment}"`);
    }

    return segment;
  }

  static parseCaller(context: Context): Caller {
    const timezone = context.request.query.timezone?.toString();
    const { ip } = context.request;

    if (!timezone) {
      throw new ValidationError('Missing timezone');
    }

    if (!QueryStringParser.VALID_TIMEZONES.has(timezone)) {
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

      QueryStringParser.VALID_TIMEZONES.add(timezone);
    }

    let projectName: string;
    let environmentName: string;

    try {
      const forestContextUrl = context.request.headers['forest-context-url'] as string;
      [, , projectName, environmentName] = /https:\/\/([^\/]*)\/([^\/]*)\/([^\/]*)/.exec(
        forestContextUrl,
      );
    } catch (error) {
      // Silent error, as this is not critical.
      // Just like in v1, Forest-Context-Url is not always available.
    }

    return {
      ...context.state.user,
      timezone,
      requestId: uuidv4(),
      projectName,
      environmentName,
      request: { ip },
    };
  }

  static parsePagination(context: Context): Page {
    const { query, body } = context.request as any;
    const queryItemsPerPage = (
      body?.data?.attributes?.all_records_subset_query?.['page[size]'] ??
      query['page[size]'] ??
      DEFAULT_ITEMS_PER_PAGE
    ).toString();
    const queryPageToSkip = (
      body?.data?.attributes?.all_records_subset_query?.['page[number]'] ??
      query['page[number]'] ??
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
    const { query, body } = context.request as any;
    const sortString =
      body?.data?.attributes?.all_records_subset_query?.sort?.toString() ?? query.sort?.toString();

    try {
      if (!sortString) return SortFactory.byPrimaryKeys(collection);

      const sort = new Sort(
        ...sortString.split(',').map((sortChunk: string) => ({
          field: sortChunk.replace(/^-/, '').replace('.', ':'),
          ascending: !sortChunk.startsWith('-'),
        })),
      );

      SortValidator.validate(collection, sort);

      return sort;
    } catch {
      throw new ValidationError(`Invalid sort: ${sortString}`);
    }
  }
}
