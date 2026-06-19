import type { CollectionSchema } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import {
  ConditionTreeFactory,
  PaginatedFilter,
  Projection,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { DateTime } from 'luxon';

import revertRecord from './audit-trail-revert';
import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// Date with a wall-clock time, `T` or space separator, seconds optional: `YYYY-MM-DD[T| ]HH:mm[:ss]`.
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
// ISO 8601 instant: carries its own timezone designator (`Z` or `±HH:mm` / `±HHMM`).
const ISO_INSTANT = /[Zz]$|[+-]\d{2}:?\d{2}$/;

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
    router.get(`/_audit-trail/${this.collectionUrlSlug}/:id/state`, this.handleStateAt.bind(this));
  }

  public async handleHistory(context: Context): Promise<void> {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const { store } = this.options.auditTrail;
    const { skip, limit } = AuditTrailRoute.parsePagination(context);
    const order = AuditTrailRoute.parseSort(context);
    const { userIds, startTimestamp, endTimestamp } = AuditTrailRoute.parseFilters(context);

    // context.params.id is already Forest's packed id, the form the audit store keys on.
    const filters = {
      collection: this.collection.name,
      recordId: context.params.id,
      ...(userIds && { userIds }),
      ...(startTimestamp && { startTimestamp }),
      ...(endTimestamp && { endTimestamp }),
    };

    // `count` reflects the active filters (not the absolute total) and is independent of the page.
    const [data, count] = await Promise.all([
      store.listByRecord({ ...filters, skip, limit, order }),
      store.countByRecord(filters),
    ]);

    context.response.body = { data, meta: { count } };
  }

  // Only audited columns are returned; read-only/computed fields are not captured in the log.
  public async handleStateAt(context: Context): Promise<void> {
    await this.services.authorization.assertCanRead(context, this.collection.name);

    const at = AuditTrailRoute.parseAt(context);
    const auditedColumns = AuditTrailRoute.auditedColumns(this.collection.schema);
    const current = await this.fetchCurrentRecord(context, auditedColumns);

    const { store } = this.options.auditTrail;
    const entries = await store.listByRecord({
      collection: this.collection.name,
      recordId: context.params.id,
      startTimestamp: at,
      order: 'desc',
    });

    const state = revertRecord(current, entries as Parameters<typeof revertRecord>[1]);

    if (!state) context.throw(HttpCode.NotFound, 'Record did not exist at this timestamp');

    context.response.body = { data: state };
  }

  private async fetchCurrentRecord(
    context: Context,
    auditedColumns: string[],
  ): Promise<Record<string, unknown> | null> {
    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        ConditionTreeFactory.matchIds(this.collection.schema, [id]),
        await this.services.authorization.getScope(this.collection, context),
      ),
    });

    const records = await this.collection.list(
      QueryStringParser.parseCaller(context, { defaultTimezone: 'UTC' }),
      filter,
      new Projection(...auditedColumns),
    );

    return records[0] ?? null;
  }

  // Must mirror the audit-trail plugin's column selection (writable + primary keys, including
  // read-only PKs) so the reconstructed record carries the same columns the log captured.
  private static auditedColumns(schema: CollectionSchema): string[] {
    const writable = Object.keys(schema.fields).filter(name => {
      const field = schema.fields[name];

      return field.type === 'Column' && !field.isReadOnly;
    });

    return [...new Set([...SchemaUtils.getPrimaryKeys(schema), ...writable])];
  }

  private static parseAt(context: Context): string {
    const query = context.request.query as Record<string, unknown>;
    const raw = query.at?.toString();

    if (!raw) throw new ValidationError('Missing "at" query parameter');

    const timezone = query.timezone?.toString() || 'UTC';

    return AuditTrailRoute.parseDateBoundary(raw, timezone, 'start') as string;
  }

  // JSON:API `sort`: `timestamp` → oldest first, `-timestamp` → newest first. Anything else
  // (absent or unsupported) defaults to newest first.
  private static parseSort(context: Context): 'asc' | 'desc' {
    const sort = (context.request.query as Record<string, unknown>).sort?.toString();

    return sort === 'timestamp' ? 'asc' : 'desc';
  }

  // JSON:API pagination: 1-based `page[number]` (default 1) and `page[size]` (default 20, capped
  // at 100). Out-of-bound or non-numeric values fall back to the defaults rather than erroring.
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
          : `Invalid date: "${raw}" (expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or an ISO 8601 instant)`,
      );
    }

    return instant.toUTC().toISO() ?? undefined;
  }

  private static toLocalInstant(
    raw: string,
    timezone: string,
    boundary: 'start' | 'end',
  ): DateTime {
    // An embedded offset already pins the instant — the request timezone and start/end boundary
    // don't apply.
    if (ISO_INSTANT.test(raw)) return DateTime.fromISO(raw, { setZone: true });

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
