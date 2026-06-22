import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type KoaRouter from '@koa/router';
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import type { Context } from 'koa';

import { NotFoundError } from '@forestadmin/datasource-toolkit';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

const AGENT_PREFIX = '/_internal/workflow-executions';
const EXECUTOR_PREFIX = '/runs';
// Hop-by-hop headers + those the HTTP client recomputes — never forwarded.
const SKIPPED_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'proxy-authenticate',
  'proxy-authorization',
  'host',
  'content-length',
]);
// Substrings that could let the wildcard escape EXECUTOR_PREFIX (traversal, encoded dots,
// backslash, null byte).
const UNSAFE_PATH_FRAGMENTS = ['..', '%2e', '%2E', '\\', '\0'];
const REQUEST_TIMEOUT_MS = 120_000;

export default class WorkflowExecutorProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly executorUrl: URL;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
    super(services, options);
    // Remove trailing slash for clean URL joining
    this.executorUrl = new URL(options.workflowExecutorUrl.replace(/\/+$/, ''));
  }

  // Single catch-all: any sub-path/verb under AGENT_PREFIX is forwarded to EXECUTOR_PREFIX, so a
  // new executor route needs no change here (PRD-567).
  setupRoutes(router: KoaRouter): void {
    router.all(`${AGENT_PREFIX}/:path(.*)`, this.handleProxy.bind(this));
  }

  private async handleProxy(context: Context): Promise<void> {
    const targetUrl = this.buildTargetUrl(context);

    const response = await this.forwardRequest(
      context.method,
      targetUrl,
      // Raw body forwarded verbatim (set by @koa/bodyparser); undefined for GET.
      context.method === 'GET' ? undefined : context.request.rawBody,
      this.forwardedHeaders(context),
    );

    context.response.status = response.status;

    // Forward every executor response header (minus hop-by-hop) so new executor headers never
    // require an agent change (PRD-567: zero breaking, the agent stays a transparent proxy).
    for (const [name, value] of Object.entries(response.headers)) {
      if (value !== undefined && !SKIPPED_HEADERS.has(name.toLowerCase())) {
        context.response.set(name, value);
      }
    }

    context.response.body = response.body;
  }

  private buildTargetUrl(context: Context): URL {
    const path = this.executorPath(String(context.params.path ?? ''));
    const qs = context.querystring ? `?${context.querystring}` : '';

    return new URL(`${path}${qs}`, this.executorUrl);
  }

  // Security boundary: the wildcard can only ever map into EXECUTOR_PREFIX. Reject anything that
  // could escape it so executor routes outside EXECUTOR_PREFIX stay unreachable through the proxy.
  private executorPath(wildcard: string): string {
    const unsafe =
      wildcard === '' ||
      wildcard.startsWith('/') ||
      UNSAFE_PATH_FRAGMENTS.some(fragment => wildcard.includes(fragment));

    if (unsafe) throw new NotFoundError('Invalid workflow executor path');

    return `${EXECUTOR_PREFIX}/${wildcard}`;
  }

  // Forwards every client header except hop-by-hop / client-recomputed ones (Q4).
  private forwardedHeaders(context: Context): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = {};

    for (const [name, value] of Object.entries(context.request.headers)) {
      if (value !== undefined && !SKIPPED_HEADERS.has(name.toLowerCase())) {
        headers[name] = value;
      }
    }

    return headers;
  }

  private forwardRequest(
    method: string,
    url: URL,
    body: string | undefined,
    headers: OutgoingHttpHeaders,
  ): Promise<{ status: number; body: unknown; headers: IncomingHttpHeaders }> {
    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const req = requestFn(url, { method, headers, timeout: REQUEST_TIMEOUT_MS }, res => {
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

          resolve({
            status: res.statusCode ?? HttpCode.InternalServerError,
            body: parsed,
            headers: res.headers,
          });
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('Workflow executor request timed out')));

      if (body !== undefined && method !== 'GET') req.write(body);

      req.end();
    });
  }
}
