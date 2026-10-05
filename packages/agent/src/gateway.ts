import type { BffEmbedOptions, GatewayOptions, McpEmbedOptions } from './types';

export type GatewayMcpOptions = Omit<McpEmbedOptions, 'basePath' | 'allowedOAuthClients'>;

export type GatewayServices = { mcp: GatewayMcpOptions | null; api: BffEmbedOptions | null };

const TOP_LEVEL_OPTIONS = ['basePath', 'allowedOAuthClients'] as const;

function resolveService<T extends object>(service: T | boolean | undefined): T | null {
  if (service === true) return {} as T;

  return service || null;
}

export function resolveGatewayServices({ mcp, api }: GatewayOptions): GatewayServices {
  const mcpOptions = resolveService(mcp);
  const nested = TOP_LEVEL_OPTIONS.find(option => mcpOptions && option in mcpOptions);

  if (nested) {
    throw new Error(
      `addGateway({ mcp: { ${nested} } }) is not supported: ${nested} covers every Gateway ` +
        `service, set it as addGateway({ ${nested} }).`,
    );
  }

  return { mcp: mcpOptions, api: resolveService(api) };
}

const isWithin = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

export function assertNoGatewayOverlap(
  basePath: string,
  forestPath: string,
  { mcp, api }: GatewayServices,
): void {
  if (basePath && isWithin(basePath, forestPath)) {
    throw new Error(
      `basePath "${basePath}" overlaps the agent routes on ${forestPath}: ` +
        'change the Gateway basePath or the agent prefix.',
    );
  }

  const claimed = [
    ...(mcp
      ? [
          { path: `${basePath}/mcp`, service: 'MCP' },
          { path: `${basePath}/oauth`, service: 'MCP' },
        ]
      : []),
    ...(api ? [{ path: `${basePath}/api/agent`, service: 'API' }] : []),
  ];
  const overlap = claimed.find(({ path }) => isWithin(forestPath, path));

  if (overlap) {
    throw new Error(
      `The agent routes on ${forestPath} overlap ${overlap.path}, claimed by the Gateway ` +
        `${overlap.service}: change the agent prefix or the Gateway basePath.`,
    );
  }
}

function servesInMemoryUploads({ fileUploads, enabledTools }: GatewayMcpOptions): boolean {
  if (fileUploads === false || fileUploads?.storage) return false;

  return !enabledTools || enabledTools.includes('requestActionFileUpload');
}

export function describeGatewayRoutes(basePath: string, { mcp, api }: GatewayServices): string[] {
  const lines: string[] = [];

  if (mcp) {
    const discovery = basePath
      ? [
          `/.well-known/oauth-authorization-server${basePath}`,
          `/.well-known/oauth-protected-resource${basePath}/mcp`,
        ]
      : ['/.well-known/*'];
    const routes = [
      `${basePath}/mcp`,
      ...(servesInMemoryUploads(mcp) ? [`${basePath}/mcp/uploads`] : []),
      `${basePath}/oauth/*`,
      ...discovery,
    ];

    lines.push(`[Gateway] MCP: ${routes.join(', ')}`);
  }

  if (api) {
    const routes = [
      `${basePath}/api/agent/*`,
      `${basePath}/api/health`,
      ...(api.openapiEnabled ? [`${basePath}/api/docs`] : []),
    ];
    const oauth = api.tokenEncryptionKey
      ? `, ${basePath}/oauth/*?service=api`
      : ' (API OAuth off: no tokenEncryptionKey)';

    lines.push(`[Gateway] API: ${routes.join(', ')}${oauth}`);
  }

  return lines;
}
