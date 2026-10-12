import type { HttpCallback } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { ServerResponse } from 'http';

/**
 * Where an embedded BFF answers, at the root of the host application. Fixed: the BFF serves its own
 * `/oauth/*` and `/docs`, which would otherwise collide with the MCP server's root paths and with
 * whatever the host already serves.
 */
export const BFF_PREFIX = '/bff';

/**
 * Matches on the pathname and on a segment boundary, so `/bff?x=1` is claimed and `/bffalo` is not.
 */
export function isBffRoute(url: string): boolean {
  const [pathname] = url.split(/[?#]/, 1);

  return pathname === BFF_PREFIX || pathname.startsWith(`${BFF_PREFIX}/`);
}

/**
 * The url the BFF itself expects: it knows nothing of the prefix the host serves it under, and its
 * routes are absolute (`/agent/v1/…`, `/health`). Never yields an empty string — Koa would read that
 * as a malformed request rather than as the root.
 */
export function stripBffPrefix(url: string): string {
  if (!isBffRoute(url)) return url;

  const remainder = url.slice(BFF_PREFIX.length);

  if (remainder === '') return '/';

  return remainder.startsWith('/') ? remainder : `/${remainder}`;
}

export const BFF_DEPRECATION_TIMESTAMP = Date.UTC(2026, 9, 5) / 1000;
export const BFF_DEPRECATION_LINK = 'https://docs.forestadmin.com/product/embed/bff';
export const BFF_DEPRECATION_LOG_INTERVAL_MS = 60 * 60 * 1000;

const EXPOSE_HEADERS = 'Access-Control-Expose-Headers';
const DEPRECATION_HEADERS = ['Deprecation', 'Link'];
const DEPRECATION_LINK = `<${BFF_DEPRECATION_LINK}>; rel="deprecation"`;

function headerValues(res: ServerResponse, name: string): string[] {
  const value = res.getHeader(name);

  return value === undefined ? [] : [value].flat().map(String);
}

function markDeprecated(res: ServerResponse): void {
  const exposed = headerValues(res, EXPOSE_HEADERS)
    .flatMap(value => value.split(','))
    .map(name => name.trim())
    .filter(Boolean);
  const links = headerValues(res, 'Link');

  res.setHeader('Deprecation', `@${BFF_DEPRECATION_TIMESTAMP}`);

  if (!links.includes(DEPRECATION_LINK)) {
    res.setHeader('Link', [...links, DEPRECATION_LINK].join(', '));
  }

  res.setHeader(EXPOSE_HEADERS, [...new Set([...exposed, ...DEPRECATION_HEADERS])].join(', '));
}

function markDeprecatedOnWriteHead(res: ServerResponse): void {
  const { writeHead } = res;

  res.writeHead = ((...args: Parameters<typeof writeHead>) => {
    markDeprecated(res);

    return writeHead.apply(res, args);
  }) as typeof writeHead;
}

export function createBffAliasCallback(handle: HttpCallback, logger: Logger): HttpCallback {
  let lastWarnedAt: number | null = null;

  return (req, res, next) => {
    const now = Date.now();

    if (lastWarnedAt === null || now - lastWarnedAt >= BFF_DEPRECATION_LOG_INTERVAL_MS) {
      lastWarnedAt = now;
      logger(
        'Warn',
        `[BFF] ${BFF_PREFIX}/* is deprecated and was called: use addGateway({ api }), ` +
          `which serves the same routes under <basePath>/api (/api by default). ` +
          `See ${BFF_DEPRECATION_LINK}`,
      );
    }

    const aliasReq = req as typeof req & { originalUrl?: string };
    aliasReq.originalUrl ??= req.url;
    req.url = stripBffPrefix(req.url ?? BFF_PREFIX);
    markDeprecatedOnWriteHead(res);
    handle(req, res, next);
  };
}

/**
 * Whether an MCP mount path would land inside `/bff`. The MCP server normalizes its `basePath`
 * (trim, leading slash, collapsed and stripped trailing slashes) before deriving
 * `<basePath>/oauth/` and `<basePath>/mcp`, so comparing the raw option to `/bff` would let `bff`,
 * `/bff/` and `/bff/ai` through — each of which claims paths the BFF answers on. The normalization
 * is mirrored rather than imported: mcp-server keeps it internal.
 */
export function collidesWithBff(mcpBasePath?: string): boolean {
  if (!mcpBasePath) return false;

  const trimmed = mcpBasePath.trim();

  if (trimmed === '' || trimmed === '/') return false;

  const normalized = (trimmed.startsWith('/') ? trimmed : `/${trimmed}`)
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '');

  return isBffRoute(`${normalized}/mcp`);
}
