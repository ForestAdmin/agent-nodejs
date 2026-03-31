import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class WorkflowExecutorProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly executorUrl: URL;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
    super(services, options);
    // Remove trailing slash for clean URL joining
    this.executorUrl = new URL(options.workflowExecutorUrl.replace(/\/+$/, ''));
  }

  private static readonly AGENT_PREFIX = '/_internal/workflow-executions';
  private static readonly EXECUTOR_PREFIX = '/runs';

  setupRoutes(router: KoaRouter): void {
    router.get('/_internal/workflow-executions/:runId', this.handleProxy.bind(this));
    router.post('/_internal/workflow-executions/:runId/trigger', this.handleProxy.bind(this));
    router.patch(
      '/_internal/workflow-executions/:runId/steps/:stepIndex/pending-data',
      this.handleProxy.bind(this),
    );
  }

  private async handleProxy(context: Context): Promise<void> {
    // Rewrite /_internal/workflow-executions/... → /runs/...
    const executorPath = context.path.replace(
      WorkflowExecutorProxyRoute.AGENT_PREFIX,
      WorkflowExecutorProxyRoute.EXECUTOR_PREFIX,
    );
    const targetUrl = new URL(executorPath, this.executorUrl);

    const response = await this.forwardRequest(context.method, targetUrl, context.request.body);

    context.response.status = response.status;
    context.response.body = response.body;
  }

  private forwardRequest(
    method: string,
    url: URL,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const req = requestFn(
        url,
        { method, headers: { 'Content-Type': 'application/json' } },
        res => {
          const chunks: Uint8Array[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            let parsed: unknown;

            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }

            resolve({ status: res.statusCode ?? HttpCode.InternalServerError, body: parsed });
          });
          res.on('error', reject);
        },
      );

      req.on('error', reject);

      if (body && method !== 'GET') {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}
