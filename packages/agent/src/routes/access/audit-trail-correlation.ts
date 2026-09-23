import type { AuditRecord } from '../../audit-trail';
import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type { Collection, ConditionTree, DataSource } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import checkRecordVisibility from '../../audit-trail/record-visibility';
import withholdOutsidePermissionScope from '../../audit-trail/withhold';
import { HttpCode, RouteType } from '../../types';
import QueryStringParser from '../../utils/query-string';
import BaseRoute from '../base-route';

type Target = {
  collection: string;
  recordId: string;
  collectionObject: Collection;
  permissionScope: ConditionTree | null;
  goneEntirely: boolean;
};

export default class AuditTrailCorrelationRoute extends BaseRoute {
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
    router.get('/_audit-trail/correlation/:correlationKey', this.handleHistory.bind(this));
    // POST accepts the keys in a JSON body to dodge any URL length limit.
    router.get('/_audit-trail/correlations', this.handleBatch.bind(this));
    router.post('/_audit-trail/correlations', this.handleBatch.bind(this));
  }

  public async handleHistory(context: Context): Promise<void> {
    const target = await this.assertRecordReadable(context);
    if (!target) return;

    const { collection, recordId } = target;
    const { store } = this.options.auditTrail;
    const history = await store.listByCorrelation({
      collection,
      recordId,
      correlationKey: context.params.correlationKey,
    });

    context.response.body = { data: this.withhold(history, target, context) };
  }

  public async handleBatch(context: Context): Promise<void> {
    const target = await this.assertRecordReadable(context);
    if (!target) return;

    const { collection, recordId } = target;
    const correlationKeys = AuditTrailCorrelationRoute.parseCorrelationKeys(context);

    const { store } = this.options.auditTrail;
    const history = correlationKeys.length
      ? await store.listByCorrelations({ collection, recordId, correlationKeys })
      : [];

    context.response.body = { data: this.withhold(history, target, context) };
  }

  // Same rule as the per-record history route: these routes return the same rows, so a gone
  // record's captured values are tested against the caller's permission scope here too. Without it the
  // values the history route withholds come back through a correlation lookup.
  private withhold(entries: AuditRecord[], target: Target, context: Context): AuditRecord[] {
    if (!target.permissionScope || !target.goneEntirely) return entries;

    return withholdOutsidePermissionScope(entries, {
      collection: target.collectionObject,
      permissionScope: target.permissionScope,
      timezone: QueryStringParser.parseCaller(context, { defaultTimezone: 'UTC' }).timezone,
    });
  }

  // Returns null (after issuing the 404) when a configured record-level permission scope excludes the id —
  // same rule as the per-collection route: a scope can't be evaluated retroactively for a
  // now-deleted record, so a scoped caller cannot look up correlations for an out-of-scope id.
  private async assertRecordReadable(context: Context): Promise<Target | null> {
    const query = context.request.query as Record<string, unknown>;
    const body = (context.request.body ?? {}) as Record<string, unknown>;
    const collectionName = (query.collection ?? body.collection)?.toString();
    const recordId = (query.recordId ?? body.recordId)?.toString();

    if (!collectionName) throw new ValidationError('Missing collection');
    if (!recordId) throw new ValidationError('Missing recordId');

    const collection = this.dataSource.getCollection(collectionName);
    await this.services.authorization.assertCanRead(context, collectionName);

    const permissionScope = await this.services.authorization.getScope(collection, context);
    const { visible, goneEntirely } = await checkRecordVisibility(
      this.services,
      collection,
      recordId,
      context,
    );

    if (!visible) {
      context.throw(HttpCode.NotFound, 'Record does not exists');

      return null;
    }

    return {
      collection: collectionName,
      recordId,
      collectionObject: collection,
      permissionScope,
      goneEntirely,
    };
  }

  // Body array (POST) takes precedence over the comma-separated query param (GET).
  private static parseCorrelationKeys(context: Context): string[] {
    const body = (context.request.body ?? {}) as Record<string, unknown>;

    if (Array.isArray(body.correlationKeys)) {
      return body.correlationKeys.map(key => String(key).trim()).filter(Boolean);
    }

    const raw = (context.request.query as Record<string, unknown>).correlationKeys?.toString();

    return raw
      ? raw
          .split(',')
          .map(key => key.trim())
          .filter(Boolean)
      : [];
  }
}
