import type { HttpCallback } from './server';
import type { IncomingMessage, ServerResponse } from 'http';

import { normalizeMountPath } from './mcp-paths';

export type GatewayHandler = { matches: (url: string) => boolean; callback: HttpCallback };

export type GatewaySwitchOptions = {
  basePath?: string;
  mcp?: GatewayHandler;
  api?: GatewayHandler;
};

const SERVICE_PARAM = 'service';
const API_SERVICE = 'api';
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

type ErrorRoute = {
  status: typeof HTTP_BAD_REQUEST | typeof HTTP_NOT_FOUND;
  error: string;
  description: string;
};
type HandlerRoute = { handler: GatewayHandler; strip?: string };
type Route = HandlerRoute | ErrorRoute;
type Services = { prefix: string; mcp?: GatewayHandler; api?: GatewayHandler };

const UNSUPPORTED_SERVICE: ErrorRoute = {
  status: HTTP_BAD_REQUEST,
  error: 'invalid_request',
  description: `Unsupported "${SERVICE_PARAM}" parameter: use "${API_SERVICE}" or omit it.`,
};

const API_DISABLED: ErrorRoute = {
  status: HTTP_NOT_FOUND,
  error: 'not_found',
  description: 'The API service is not enabled on this Gateway.',
};

const UNCLAIMED: ErrorRoute = {
  status: HTTP_NOT_FOUND,
  error: 'not_found',
  description: 'No Gateway service serves this path.',
};

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function readServices(url: string, pathname: string): string[] {
  const [query] = url.slice(pathname.length).split('#', 1);

  return new URLSearchParams(query).getAll(SERVICE_PARAM);
}

function routeOAuth({ prefix, mcp, api }: Services, url: string, pathname: string): Route | null {
  const services = readServices(url, pathname);

  if (services.length === 1 && services[0] === API_SERVICE) {
    return api ? { handler: api, strip: prefix } : API_DISABLED;
  }

  if (!mcp?.matches(url)) return null;

  return services.length === 0 ? { handler: mcp } : UNSUPPORTED_SERVICE;
}

function routeApi({ prefix, api }: Services, pathname: string): HandlerRoute | null {
  const apiPrefix = `${prefix}/api`;
  if (!api || !isUnder(pathname, apiPrefix)) return null;

  return api.matches(pathname.slice(apiPrefix.length) || '/')
    ? { handler: api, strip: apiPrefix }
    : null;
}

function routeMcp({ mcp }: Services, url: string): HandlerRoute | null {
  return mcp?.matches(url) ? { handler: mcp } : null;
}

function route(services: Services, url: string): Route | null {
  const [pathname] = url.split(/[?#]/, 1);

  const oauthPrefix = `${services.prefix}/oauth/`;

  if (pathname.startsWith(oauthPrefix)) {
    const hasFirstSegment = /^[^/]/.test(pathname.slice(oauthPrefix.length));

    return hasFirstSegment ? routeOAuth(services, url, pathname) : null;
  }

  return routeApi(services, pathname) ?? routeMcp(services, url);
}

function answerError(res: ServerResponse, { status, error, description }: ErrorRoute): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error, error_description: description }));
}

function stripUrl(req: IncomingMessage, url: string, prefix: string): void {
  const stripped = url.slice(prefix.length);
  const strippedReq = req as IncomingMessage & { originalUrl?: string };

  strippedReq.originalUrl ??= url;
  req.url = stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export default function createGatewaySwitch({
  basePath,
  mcp,
  api,
}: GatewaySwitchOptions): GatewayHandler {
  const services: Services = { prefix: normalizeMountPath(basePath, 'basePath'), mcp, api };

  const callback: HttpCallback = (req, res, next) => {
    const url = req.url ?? '/';
    const found = route(services, url) ?? (next ? null : UNCLAIMED);

    if (!found) {
      next?.();
    } else if ('handler' in found) {
      if (found.strip !== undefined) stripUrl(req, url, found.strip);
      found.handler.callback(req, res, next);
    } else {
      answerError(res, found);
    }
  };

  return { matches: url => route(services, url) !== null, callback };
}
