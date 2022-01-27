import {
  Collection,
  constants,
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

const { QUERY_PAGE_DEFAULT_LIMIT, QUERY_PAGE_DEFAULT_SKIP } = constants;

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
    return context.request.query.search?.toString();
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
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      context.throw(HttpCode.BadRequest, `Invalid timezone: "${timezone}"`);
    }

    return timezone;
  }

  static parsePagination(context: Context): Page {
    const queryLimit = (context.request.query['page[size]'] || QUERY_PAGE_DEFAULT_LIMIT).toString();
    const querySkip = (context.request.query['page[number]'] || QUERY_PAGE_DEFAULT_SKIP).toString();

    const limit = Number.parseInt(queryLimit, 10);
    let skip = Number.parseInt(querySkip, 10);

    if (Number.isNaN(limit) || Number.isNaN(skip) || limit <= 0 || skip <= 0) {
      context.throw(HttpCode.BadRequest, `Invalid pagination: "limit: ${limit}, skip: ${skip}"`);
    }

    skip = Math.max(skip - 1, 0);
    skip *= limit;

    return new Page(skip, limit);
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
