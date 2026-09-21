import type { AuditRecord } from '../../audit-trail';
import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import withholdValuesFromNonAdmin from '../../audit-trail/admin-gate';
import {
  parseDateBoundary,
  parseOperations,
  parsePageSize,
  parseSearch,
  parseUserIds,
} from '../../audit-trail/query-params';
import { RouteType } from '../../types';
import BaseRoute from '../base-route';

type Cursor = { before?: string; excludeIds: number[] };

export default class AuditTrailTimelineRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;

  private readonly dataSource: DataSource;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
  ) {
    super(services, options);
    this.dataSource = dataSource;
  }

  setupRoutes(router: Router): void {
    router.get('/_audit-trail', this.handleTimeline.bind(this));
  }

  public async handleTimeline(context: Context): Promise<void> {
    const query = context.request.query as Record<string, unknown>;
    const timezone = query.timezone?.toString() || 'UTC';
    const limit = parsePageSize(query['page[size]']?.toString());
    const cursor = AuditTrailTimelineRoute.parseCursor(context);

    // Parsed before the permission sweep so a malformed filter reads as a 400 whatever the caller
    // is allowed to see.
    const filters = {
      userIds: parseUserIds(query.userIds?.toString()),
      operations: parseOperations(query.operation?.toString()),
      startTimestamp: parseDateBoundary(query.startDate?.toString(), timezone, 'start'),
      endTimestamp: parseDateBoundary(query.endDate?.toString(), timezone, 'end'),
      search: parseSearch(query.search?.toString()),
    };

    const collections = await this.readableCollections(context);
    const { store } = this.options.auditTrail;

    // One row over the page: the only way to know whether a further page exists without a count.
    const fetched = collections.length
      ? await store.listTimeline({ ...filters, ...cursor, collections, limit: limit + 1 })
      : [];
    const page = fetched.slice(0, limit);

    context.response.body = {
      data: withholdValuesFromNonAdmin(page, context),
      meta: {
        cursor: fetched.length > limit ? AuditTrailTimelineRoute.nextCursor(page, cursor) : null,
      },
    };
  }

  // Collections whose rows this caller may see at all. A record-level scope can't be evaluated
  // across a whole timeline without fetching every record it mentions, so a collection the caller
  // only sees through a scope is left out entirely rather than surfaced unfiltered: the row alone
  // would reveal that a record it cannot read exists and was touched.
  private async readableCollections(context: Context): Promise<string[]> {
    const names = await Promise.all(
      this.dataSource.collections.map(async collection => {
        const readable = await this.services.authorization.canRead(context, collection.name);

        if (!readable) return null;

        return (await this.services.authorization.getScope(collection, context))
          ? null
          : collection.name;
      }),
    );

    return names.filter(Boolean);
  }

  // `before` is an inclusive upper bound, so the rows sharing the last row's timestamp are carried
  // over as `excludeIds` rather than being skipped — that is what keeps a tie from falling between
  // two pages. When the previous page ended on the same timestamp its exclusions still apply, so a
  // timestamp holding more rows than fit on one page walks forward instead of looping.
  private static nextCursor(page: AuditRecord[], previous: Cursor): Cursor {
    const last = page[page.length - 1];
    const carried = previous.before === last.timestamp ? previous.excludeIds : [];
    const tied = page.filter(row => row.timestamp === last.timestamp).map(row => row.id);

    return { before: last.timestamp, excludeIds: [...new Set([...carried, ...tied])] };
  }

  private static parseCursor(context: Context): Cursor {
    const query = context.request.query as Record<string, unknown>;
    const before = parseDateBoundary(query.before?.toString(), 'UTC', 'end');
    const excludeIds = (query.excludeIds?.toString() ?? '')
      .split(',')
      .map(token => token.trim())
      .filter(token => /^\d+$/.test(token))
      .map(token => Number.parseInt(token, 10));

    return { before, excludeIds };
  }
}
