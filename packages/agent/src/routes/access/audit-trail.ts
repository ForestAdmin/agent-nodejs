import type Router from '@koa/router';
import type { Context } from 'koa';

import { ValidationError } from '@forestadmin/datasource-toolkit';
import { DateTime } from 'luxon';

import CollectionRoute from '../collection-route';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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
    const { skip, limit } = AuditTrailRoute.parsePagination(context);
    const order = AuditTrailRoute.parseSort(context);
    const { userIds, startTimestamp, endTimestamp } = AuditTrailRoute.parseFilters(context);

    const filters = {
      collection: this.collection.name,
      recordId: context.params.id,
      ...(userIds && { userIds }),
      ...(startTimestamp && { startTimestamp }),
      ...(endTimestamp && { endTimestamp }),
    };

    // `count` reflects the active filters and is independent of the page.
    const [data, count] = await Promise.all([
      store.listByRecord({ ...filters, skip, limit, order }),
      store.countByRecord(filters),
    ]);

    context.response.body = { data, meta: { count } };
  }

  // JSON:API `sort=timestamp` → oldest first, anything else (or absent) → newest first.
  private static parseSort(context: Context): 'asc' | 'desc' {
    const sort = (context.request.query as Record<string, unknown>).sort?.toString();

    return sort === 'timestamp' ? 'asc' : 'desc';
  }

  // 1-based `page[number]` (default 1) and `page[size]` (default 20, capped at 100). Invalid values
  // fall back to the defaults rather than erroring.
  private static parsePagination(context: Context): { skip: number; limit: number } {
    const query = context.request.query as Record<string, unknown>;
    const size = AuditTrailRoute.parsePageSize(query['page[size]']?.toString());
    const number = AuditTrailRoute.parsePageNumber(query['page[number]']?.toString());

    return { skip: (number - 1) * size, limit: size };
  }

  private static parsePageSize(raw?: string): number {
    const size = Number.parseInt(raw ?? '', 10);

    if (Number.isNaN(size) || size < 1) return DEFAULT_PAGE_SIZE;

    return Math.min(size, MAX_PAGE_SIZE);
  }

  private static parsePageNumber(raw?: string): number {
    const number = Number.parseInt(raw ?? '', 10);

    return Number.isNaN(number) || number < 1 ? 1 : number;
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

  // Bare day (`YYYY-MM-DD`) or wall-clock datetime (`YYYY-MM-DD[T| ]HH:mm[:ss]`), interpreted as
  // local time in the request timezone and returned as a UTC instant so the store can compare it
  // to stored timestamps.
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

      return boundary === 'end' ? day.endOf('day') : day.startOf('day');
    }

    const match = DATE_TIME.exec(raw);

    if (!match) return DateTime.invalid('unparsable');

    const [, date, hours, minutes, seconds] = match;
    const base = DateTime.fromISO(`${date}T${hours}:${minutes}`, { zone: timezone });

    if (seconds !== undefined) return base.set({ second: Number(seconds), millisecond: 0 });

    // Minutes-only: end snaps to :59.999 to stay inclusive; start stays at :00.000.
    return boundary === 'end' ? base.set({ second: 59, millisecond: 999 }) : base;
  }
}
