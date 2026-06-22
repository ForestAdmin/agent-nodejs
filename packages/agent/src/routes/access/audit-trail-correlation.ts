import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import { RouteType } from '../../types';
import BaseRoute from '../base-route';

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
    const { collection, recordId } = await this.assertRecordReadable(context);

    const { store } = this.options.auditTrail;
    const history = await store.listByCorrelation({
      collection,
      recordId,
      correlationKey: context.params.correlationKey,
    });

    context.response.body = { data: history };
  }

  public async handleBatch(context: Context): Promise<void> {
    const { collection, recordId } = await this.assertRecordReadable(context);
    const correlationKeys = AuditTrailCorrelationRoute.parseCorrelationKeys(context);

    const { store } = this.options.auditTrail;
    const history = correlationKeys.length
      ? await store.listByCorrelations({ collection, recordId, correlationKeys })
      : [];

    context.response.body = { data: history };
  }

  private async assertRecordReadable(
    context: Context,
  ): Promise<{ collection: string; recordId: string }> {
    const query = context.request.query as Record<string, unknown>;
    const body = (context.request.body ?? {}) as Record<string, unknown>;
    const collection = (query.collection ?? body.collection)?.toString();
    const recordId = (query.recordId ?? body.recordId)?.toString();

    if (!collection) throw new ValidationError('Missing collection');
    if (!recordId) throw new ValidationError('Missing recordId');

    this.dataSource.getCollection(collection);
    await this.services.authorization.assertCanRead(context, collection);

    return { collection, recordId };
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
