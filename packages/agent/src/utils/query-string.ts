import {
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeValidator,
  FieldTypes,
  Page,
  Projection,
  ProjectionValidator,
  SchemaUtils,
  Sort,
  SortValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { HttpCode } from '../types';

const DEFAULT_ITEMS_PER_PAGE = 15;
const DEFAULT_PAGE_TO_SKIP = 1;

export default class QueryStringParser {
  static parseConditionTree(collection: Collection, context: Context): ConditionTree {
    try {
      const string = context.request.query?.filters || context.request.body?.filters;
      if (!string) return null;

      const json = JSON.parse(string);
      const conditionTree = ConditionTreeFactory.fromPlainObject(json);
      ConditionTreeValidator.validate(conditionTree, collection);

      return conditionTree;
    } catch (e) {
      throw new ValidationError(`Invalid filters (${e.message})`);
    }
  }

  static parseProjection(collection: Collection, context: Context): Projection {
    try {
      let rootFields = context.request.query[`fields[${collection.name}]`];

      rootFields = rootFields.toString().split(',');

      const explicitRequest = rootFields.map(field => {
        const schema = collection.schema.fields[field];

        return schema.type === FieldTypes.Column
          ? field
          : `${field}:${context.request.query[`fields[${field}]`]}`;
      });

      ProjectionValidator.validate(collection, explicitRequest);

      // Primary keys are not explicitly listed in the projections that the frontend
      // is sending, but are still required for the frontend to work.
      return new Projection(...explicitRequest).withPks(collection);
    } catch (e) {
      throw new ValidationError(`Invalid projection (${e.message})`);
    }
  }

  static parseSearch(collection: Collection, context: Context): string {
    const search = context.request.query.search?.toString() ?? null;

    if (search && !collection.schema.searchable) {
      context.throw(HttpCode.BadRequest, 'Collection is not searchable');
    }

    return search;
  }

  static parseSearchExtended(context: Context): boolean {
    const extended = context.request.query.searchExtended?.toString?.();

    return !!extended && extended !== '0' && extended !== 'false';
  }

  static parseSegment(collection: Collection, context: Context): string {
    const segment = context.request.query.segment?.toString();

    if (!segment) {
      return null;
    }

    if (!collection.schema.segments.includes(segment)) {
      throw new ValidationError(`Invalid segment: "${segment}"`);
    }

    return segment;
  }

  static parseTimezone(context: Context): string {
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

    return timezone;
  }

  static parsePagination(context: Context): Page {
    const queryItemsPerPage = (
      context.request.query['page[size]'] || DEFAULT_ITEMS_PER_PAGE
    ).toString();
    const queryPageToSkip = (
      context.request.query['page[number]'] || DEFAULT_PAGE_TO_SKIP
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
    const sortString = context.request.query.sort?.toString();

    try {
      if (!sortString) {
        return new Sort(
          ...SchemaUtils.getPrimaryKeys(collection.schema).map(pk => ({
            field: pk,
            ascending: true,
          })),
        );
      }

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
