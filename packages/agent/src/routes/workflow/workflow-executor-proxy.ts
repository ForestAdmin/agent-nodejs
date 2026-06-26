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

// Any sub-path under this prefix is forwarded verbatim to the executor root, so a new executor
// route needs no agent change.
const AGENT_PREFIX = '/_internal/executor';
// Never forwarded: hop-by-hop headers, Host (Node derives the executor's from the target URL),
// and length/encoding the HTTP client recomputes.
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
// Substrings that could let the wildcard escape the executor origin (traversal, encoded dots,
// backslash, null byte). SSRF hygiene — not a namespace allowlist.
const UNSAFE_PATH_FRAGMENTS = ['..', '%2e', '%2E', '\\', '\0'];
const REQUEST_TIMEOUT_MS = 120_000;

export default class WorkflowExecutorProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly executorUrl: URL;
  // Overridable so tests can exercise the timeout branch without waiting the full default.
  protected readonly requestTimeoutMs: number = REQUEST_TIMEOUT_MS;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
    super(services, options);
    this.executorUrl = new URL(options.workflowExecutorUrl.replace(/\/+$/, ''));
  }

  setupRoutes(router: KoaRouter): void {
    router.all(`${AGENT_PREFIX}/:path(.*)`, this.handleProxy.bind(this));
  }

  private async handleProxy(context: Context): Promise<void> {
    const targetUrl = this.buildTargetUrl(context);

    const response = await this.forwardRequest({
      method: context.method,
      url: targetUrl,
      // Raw body forwarded verbatim (set by @koa/bodyparser); undefined for GET.
      body: context.method === 'GET' ? undefined : context.request.rawBody,
      headers: this.forwardedHeaders(context),
    });

    context.response.status = response.status;

    // Forward every executor response header (minus hop-by-hop) so new executor headers never
    // require an agent change — the agent stays a transparent proxy.
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
    const targetUrl = new URL(`${path}${qs}`, this.executorUrl);

    // Authoritative SSRF check: URL parsing strips control chars the string guard can't see
    // (e.g. a decoded `\t//host` collapses to `//host`), so confirm we never left the executor.
    if (targetUrl.origin !== this.executorUrl.origin) {
      throw new NotFoundError('Invalid workflow executor path');
    }

    return targetUrl;
  }

  // First-pass rejection of escape attempts; the authoritative origin check is in buildTargetUrl.
  private executorPath(wildcard: string): string {
    const unsafe =
      wildcard === '' ||
      wildcard.startsWith('/') ||
      UNSAFE_PATH_FRAGMENTS.some(fragment => wildcard.includes(fragment));

    if (unsafe) throw new NotFoundError('Invalid workflow executor path');

    return `/${wildcard}`;
  }

  private forwardedHeaders(context: Context): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = {};

    for (const [name, value] of Object.entries(context.request.headers)) {
      if (value !== undefined && !SKIPPED_HEADERS.has(name.toLowerCase())) {
        headers[name] = value;
      }
    }

    return headers;
  }

  private forwardRequest(request: {
    method: string;
    url: URL;
    body: string | undefined;
    headers: OutgoingHttpHeaders;
  }): Promise<{ status: number; body: Buffer; headers: IncomingHttpHeaders }> {
    const { method, url, body, headers } = request;
    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const req = requestFn(url, { method, headers, timeout: this.requestTimeoutMs }, res => {
        const chunks: Uint8Array[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          // Forward the executor body as raw bytes. Decoding it as UTF-8 (and JSON-parsing)
          // corrupted any compressed payload while still forwarding the executor's
          // `Content-Encoding: gzip` header, so the browser failed with
          // net::ERR_CONTENT_DECODING_FAILED. Koa sends the Buffer verbatim and recomputes
          // Content-Length; Content-Type/Content-Encoding are forwarded untouched, keeping a
          // compressed body and its encoding header consistent.
          resolve({
            status: res.statusCode ?? HttpCode.InternalServerError,
            body: Buffer.concat(chunks),
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
