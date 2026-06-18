import type Router from '@koa/router';
import type { Context } from 'koa';

import { ValidationError } from '@forestadmin/datasource-toolkit';
import { DateTime } from 'luxon';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// Date with a wall-clock time, `T` or space separator, seconds optional: `YYYY-MM-DD[T| ]HH:mm[:ss]`.
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

type AuditHistoryFilters = {
  userIds?: number[];
  startTimestamp?: string;
  endTimestamp?: string;
};

export default class AuditTrailRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/_audit-trail/${this.collectionUrlSlug}/:id`, this.handleHistory.bind(this));
  }

  public async handleHistory(context: Context): Promise<void> {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const { store } = this.options.auditTrail;
    const { skip, limit } = QueryStringParser.parsePagination(context);
    const { userIds, startTimestamp, endTimestamp } = AuditTrailRoute.parseFilters(context);

    // context.params.id is already Forest's packed id, the form the audit store keys on.
    const query = {
      collection: this.collection.name,
      recordId: context.params.id,
      skip,
      limit,
      ...(userIds && { userIds }),
      ...(startTimestamp && { startTimestamp }),
      ...(endTimestamp && { endTimestamp }),
    };

    const history = await store.listByRecord(query);

    context.response.body = { data: history };
  }

  private static parseFilters(context: Context): AuditHistoryFilters {
    const query = context.request.query as Record<string, unknown>;
    const timezone = query.timezone?.toString() || 'UTC';

    return {
      userIds: AuditTrailRoute.parseUserIds(query.userIds?.toString()),
      startTimestamp: AuditTrailRoute.parseDateBoundary(
        query.startDate?.toString(),
        timezone,
        'start',
      ),
      endTimestamp: AuditTrailRoute.parseDateBoundary(query.endDate?.toString(), timezone, 'end'),
    };
  }

  // Comma-separated integer ids; non-numeric tokens are dropped. Empty after parsing → no filter.
  private static parseUserIds(raw?: string): number[] | undefined {
    if (!raw) return undefined;

    const ids = raw
      .split(',')
      .map(token => token.trim())
      .filter(token => /^\d+$/.test(token))
      .map(token => Number.parseInt(token, 10));

    return ids.length > 0 ? ids : undefined;
  }

  // `startDate` / `endDate` accept a bare day (`YYYY-MM-DD`) or a wall-clock datetime
  // (`YYYY-MM-DD[T| ]HH:mm[:ss]`). The value is read as local time in the request timezone and
  // returned as a UTC instant so the store can compare it against stored timestamps.
  private static parseDateBoundary(
    raw: string | undefined,
    timezone: string,
    boundary: 'start' | 'end',
  ): string | undefined {
    if (!raw) return undefined;

    const instant = AuditTrailRoute.toLocalInstant(raw, timezone, boundary);

    if (!instant.isValid) {
      throw new ValidationError(
        instant.invalidReason === 'unsupported zone'
          ? `Invalid timezone: "${timezone}"`
          : `Invalid date: "${raw}" (expected YYYY-MM-DD or YYYY-MM-DDTHH:mm)`,
      );
    }

    return instant.toUTC().toISO() ?? undefined;
  }

  private static toLocalInstant(
    raw: string,
    timezone: string,
    boundary: 'start' | 'end',
  ): DateTime {
    if (DATE_ONLY.test(raw)) {
      const day = DateTime.fromISO(raw, { zone: timezone });

      // Bare day → start (00:00:00.000) or end (23:59:59.999) of that local day.
      return boundary === 'end' ? day.endOf('day') : day.startOf('day');
    }

    const match = DATE_TIME.exec(raw);

    if (!match) return DateTime.invalid('unparsable');

    const [, date, hours, minutes, seconds] = match;
    const base = DateTime.fromISO(`${date}T${hours}:${minutes}`, { zone: timezone });

    if (seconds !== undefined) return base.set({ second: Number(seconds), millisecond: 0 });

    // Minutes-only: complete the end boundary to :59.999 so it stays inclusive; start stays at :00.000.
    return boundary === 'end' ? base.set({ second: 59, millisecond: 999 }) : base;
  }
}
