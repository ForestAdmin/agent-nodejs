import type { BffHealth } from '@forestadmin/agent-bff';
import type { GatewayHandler } from '@forestadmin/mcp-server';
import type { IncomingMessage, ServerResponse } from 'http';

import { makeIsMcpRoute } from '@forestadmin/mcp-server';

export const GATEWAY_VERSION_HEADER = 'X-Forest-Gateway-Version';
export const HEALTH_PATH = '/health';

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVICE_UNAVAILABLE = 503;

export type McpHealth = 'ok' | 'degraded' | 'disabled';
export type ApiHealth = Pick<BffHealth, 'status' | 'configured'> | 'disabled';

export interface GatewayHealth {
  healthy: boolean;
  version: string;
  services: { mcp: McpHealth; api: ApiHealth };
}

export interface StandaloneHandlerOptions {
  version: string;
  gatewaySwitch: GatewayHandler;
  health: () => GatewayHealth;
}

export type StandaloneCallback = (req: IncomingMessage, res: ServerResponse) => void;

function answerJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isHealthRequest(req: IncomingMessage): boolean {
  const [pathname] = (req.url ?? '/').split(/[?#]/, 1);

  return (req.method === 'GET' || req.method === 'HEAD') && pathname === HEALTH_PATH;
}

export function describeGatewayHealth(
  version: string,
  mcp: McpHealth,
  api: ApiHealth,
): GatewayHealth {
  const apiDegraded = api !== 'disabled' && api.status === 'degraded';

  return { healthy: mcp !== 'degraded' && !apiDegraded, version, services: { mcp, api } };
}

export function createUnavailableMcpHandler(basePath: string): GatewayHandler {
  return {
    matches: makeIsMcpRoute(basePath),
    callback: (_req, res) =>
      answerJson(res, HTTP_SERVICE_UNAVAILABLE, {
        error: 'service_unavailable',
        error_description: 'The MCP service is not configured on this Gateway.',
      }),
  };
}

export default function createStandaloneHandler({
  version,
  gatewaySwitch,
  health,
}: StandaloneHandlerOptions): StandaloneCallback {
  return (req, res) => {
    res.setHeader(GATEWAY_VERSION_HEADER, version);

    if (isHealthRequest(req)) {
      const report = health();

      answerJson(res, report.healthy ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE, report);

      return;
    }

    gatewaySwitch.callback(req, res, () =>
      answerJson(res, HTTP_NOT_FOUND, {
        error: 'not_found',
        error_description: 'No Gateway service serves this path.',
      }),
    );
  };
}
