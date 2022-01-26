import {
  Collection,
  FieldTypes,
  Projection,
  ProjectionUtils,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

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

      ProjectionUtils.validate(collection, explicitRequest);

      // Primary keys are not explicitly listed in the projections that the frontend
      // is sending, but are still required for the frontend to work.
      return ProjectionUtils.withPks(collection, explicitRequest);
    } catch (e) {
      context.throw(400, `Invalid projection (${e.message})`);
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
      context.throw(400, `Invalid segment: "${segment}"`);
    }

    return segment;
  }

  static parseTimezone(context: Context): string {
    const timezone = context.request.query.timezone?.toString();

    if (!timezone) {
      context.throw(400, 'Missing timezone');
    }

    // This is a method to validate a timezone using node only
    // @see https://stackoverflow.com/questions/44115681
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
      context.throw(500, 'Time zones are not available in this environment');
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      context.throw(400, `Invalid timezone: "${timezone}"`);
    }

    return timezone;
  }

  static parsePagination(context: Context): { skip: number; limit: number } {
    const limit = Number.parseInt(context.request.query['page[size]']?.toString(), 10);
    const skip =
      (Number.parseInt(context.request.query['page[number]']?.toString(), 10) - 1) * limit;

    if (skip >= 0 && limit > 0) {
      return { skip, limit };
    }

    return { skip: 0, limit: 15 };
  }
}
