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

type ErrorStatus = typeof HTTP_BAD_REQUEST | typeof HTTP_NOT_FOUND;

type ErrorRoute = { status: ErrorStatus; error: string; description: string };
type Route = { handler: GatewayHandler; strip?: string } | ErrorRoute;

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

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function readServices(url: string, pathname: string): string[] {
  const [query] = url.slice(pathname.length).split('#', 1);

  return new URLSearchParams(query).getAll(SERVICE_PARAM);
}

function stripPrefix(url: string, prefix: string): string {
  const stripped = url.slice(prefix.length);

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

function answerError(res: ServerResponse, status: ErrorStatus, error: string, description: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error, error_description: description }));
}

export default function createGatewaySwitch({
  basePath,
  mcp,
  api,
}: GatewaySwitchOptions): GatewayHandler {
  const prefix = normalizeMountPath(basePath, 'basePath');
  const oauthPrefix = `${prefix}/oauth/`;
  const apiPrefix = `${prefix}/api`;

  const routeOAuth = (url: string, pathname: string): Route | null => {
    const services = readServices(url, pathname);

    if (services.length === 1 && services[0] === API_SERVICE) {
      return api ? { handler: api, strip: prefix } : API_DISABLED;
    }

    if (!mcp?.matches(url)) return null;

    return services.length === 0 ? { handler: mcp } : UNSUPPORTED_SERVICE;
  };

  const route = (url: string): Route | null => {
    const [pathname] = url.split(/[?#]/, 1);

    if (pathname.startsWith(oauthPrefix)) return routeOAuth(url, pathname);

    if (api && isUnder(pathname, apiPrefix)) {
      const apiPathname = pathname.slice(apiPrefix.length) || '/';
      if (api.matches(apiPathname)) return { handler: api, strip: apiPrefix };
    }

    if (mcp?.matches(url)) return { handler: mcp };

    return null;
  };

  const callback: HttpCallback = (req: IncomingMessage, res: ServerResponse, next) => {
    const url = req.url ?? '/';
    const found = route(url);

    if (!found) {
      if (next) next();
      else answerError(res, HTTP_NOT_FOUND, 'not_found', 'No Gateway service serves this path.');

      return;
    }

    if (!('handler' in found)) {
      answerError(res, found.status, found.error, found.description);

      return;
    }

    if (found.strip !== undefined) {
      const strippedReq = req as IncomingMessage & { originalUrl?: string };
      strippedReq.originalUrl ??= url;
      req.url = stripPrefix(url, found.strip);
    }

    found.handler.callback(req, res, next);
  };

  return { matches: url => route(url) !== null, callback };
}
