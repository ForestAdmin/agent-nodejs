import {
  Collection,
  FieldTypes,
  Page,
  Projection,
  ProjectionValidator,
  SchemaUtils,
  Sort,
  SortValidator,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { HttpCode } from '../types';

const DEFAULT_ITEMS_PER_PAGE = 15;
const DEFAULT_PAGE_TO_SKIP = 1;

export default class QueryStringParser {
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
      context.throw(HttpCode.BadRequest, `Invalid projection (${e.message})`);
    }
  }

  static parseSearch(context: Context): string {
    return context.request.query.search?.toString() ?? null;
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
      context.throw(HttpCode.BadRequest, `Invalid segment: "${segment}"`);
    }

    return segment;
  }

  static parseTimezone(context: Context): string {
    const timezone = context.request.query.timezone?.toString();

    if (!timezone) {
      context.throw(HttpCode.BadRequest, 'Missing timezone');
    }

    // This is a method to validate a timezone using node only
    // @see https://stackoverflow.com/questions/44115681
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
      context.throw(
        HttpCode.InternalServerError,
        'Time zones are not available in this environment',
      );
    }

    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      context.throw(HttpCode.BadRequest, `Invalid timezone: "${timezone}"`);
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
      context.throw(
        HttpCode.BadRequest,
        `Invalid pagination: "limit: ${itemsPerPage}, skip: ${pageToSkip}"`,
      );
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
      context.throw(HttpCode.BadRequest, `Invalid sort: ${sortString}`);
    }
  }
}
