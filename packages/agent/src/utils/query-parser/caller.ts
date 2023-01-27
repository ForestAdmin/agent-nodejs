/* eslint-disable @typescript-eslint/no-explicit-any */
import { Caller, ValidationError } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

export default class CallerParser {
  private static VALID_TIMEZONES = new Set<string>();

  static fromCtx(context: Context): Caller {
    const timezone = context.request.query.timezone?.toString();

    if (!timezone) {
      throw new ValidationError('Missing timezone');
    }

    if (!CallerParser.VALID_TIMEZONES.has(timezone)) {
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

      CallerParser.VALID_TIMEZONES.add(timezone);
    }

    return { ...context.state.user, timezone };
  }
}
