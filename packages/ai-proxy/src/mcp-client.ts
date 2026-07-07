import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { McpConnectionError } from './errors';
import { type McpLoadFailureKind, classifyMcpLoadError } from './mcp-auth-error';
import McpServerRemoteTool from './mcp-server-remote-tool';

export type McpServers = MultiServerMCPClient['config']['mcpServers'];

export type McpServerConfig = MultiServerMCPClient['config']['mcpServers'][string] & {
  id?: string;
  // Executor-side routing hint served by the orchestrator; stripped before reaching the SDK.
  authType?: string;
};

export type McpConfiguration = {
  configs: Record<string, McpServerConfig>;
} & Omit<MultiServerMCPClient['config'], 'mcpServers'>;

export interface McpServerLoadFailure {
  server: string;
  mcpServerId?: string;
  kind: McpLoadFailureKind;
  error: Error;
}

export default class McpClient implements ToolProvider {
  private readonly mcpClients: Record<string, MultiServerMCPClient> = {};
  private readonly mcpServerIdsByName: Record<string, string | undefined> = {};
  private readonly logger?: Logger;

  constructor(config: McpConfiguration, logger?: Logger) {
    this.logger = logger;
    // split the config into several clients to be more resilient
    // if a mcp server is down, the others will still work
    Object.entries(config.configs).forEach(([name, serverConfig]) => {
      const {
        id: mcpServerId,
        authType,
        ...rest
      } = serverConfig as McpServerConfig & Record<string, unknown>;
      this.mcpServerIdsByName[name] = mcpServerId;
      this.mcpClients[name] = new MultiServerMCPClient({
        mcpServers: { [name]: rest as McpServerConfig },
        ...config,
      });
    });
  }

  // Exposes per-server failures classified by cause (auth vs connection) alongside the tools that
  // did load, so a caller holding a per-user token can tell a revoked token (retry after refresh)
  // from an unreachable server (genuine failure). loadTools() keeps its tools-only contract.
  async loadToolsWithFailures(): Promise<{
    tools: McpServerRemoteTool[];
    failures: McpServerLoadFailure[];
  }> {
    const tools: McpServerRemoteTool[] = [];
    const failures: McpServerLoadFailure[] = [];

    await Promise.all(
      Object.entries(this.mcpClients).map(async ([name, client]) => {
        try {
          const loadedTools = (await client.getTools()) ?? [];
          const extendedTools = loadedTools.map(
            tool =>
              new McpServerRemoteTool({
                tool,
                sourceId: name,
                mcpServerId: this.mcpServerIdsByName[name],
              }),
          );
          tools.push(...extendedTools);
        } catch (error) {
          this.logger?.('Error', `Error loading tools for ${name}`, error as Error);
          failures.push({
            server: name,
            mcpServerId: this.mcpServerIdsByName[name],
            kind: classifyMcpLoadError(error),
            error: error as Error,
          });
        }
      }),
    );

    // Surface partial failures to provide better feedback
    if (failures.length > 0) {
      const errorMessage = failures.map(f => `${f.server}: ${f.error.message}`).join('; ');
      this.logger?.(
        'Error',
        `Failed to load tools from ${failures.length}/${Object.keys(this.mcpClients).length} ` +
          `MCP server(s): ${errorMessage}`,
      );
    }

    return { tools, failures };
  }

  async loadTools(): Promise<McpServerRemoteTool[]> {
    return (await this.loadToolsWithFailures()).tools;
  }

  async checkConnection(): Promise<true> {
    try {
      await Promise.all(
        Object.values(this.mcpClients).map(client => client.initializeConnections()),
      );

      return true;
    } catch (error) {
      throw new McpConnectionError((error as Error).message);
    } finally {
      try {
        await this.dispose();
      } catch (cleanupError) {
        // Log but don't throw - we don't want to mask the original connection error
        this.logger?.('Error', 'Error during test connection cleanup', cleanupError as Error);
      }
    }
  }

  async dispose(): Promise<void> {
    const entries = Object.entries(this.mcpClients);
    const results = await Promise.allSettled(entries.map(([, client]) => client.close()));

    // Check for failures but don't throw - cleanup should be best-effort
    const failures = results
      .map((result, index) => ({ result, name: entries[index][0] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      failures.forEach(({ name, result }) => {
        this.logger?.(
          'Error',
          `Failed to close MCP connection for ${name}`,
          (result as PromiseRejectedResult).reason,
        );
      });
      this.logger?.(
        'Error',
        `Failed to close ${failures.length}/${results.length} MCP connections. ` +
          `This may result in resource leaks.`,
      );
    }
  }
}
