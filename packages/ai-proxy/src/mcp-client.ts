import type { Logger } from '@forestadmin/datasource-toolkit';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { McpConnectionError } from './errors';
import McpServerRemoteTool from './mcp-server-remote-tool';

export type McpServers = MultiServerMCPClient['config']['mcpServers'];

export type McpServerConfig = MultiServerMCPClient['config']['mcpServers'][string];

export type McpConfiguration = {
  configs: McpServers;
} & Omit<MultiServerMCPClient['config'], 'mcpServers'>;

export default class McpClient {
  private readonly mcpClients: Record<string, MultiServerMCPClient> = {};
  private readonly logger?: Logger;

  constructor(config: McpConfiguration, logger?: Logger) {
    this.logger = logger;
    // split the config into several clients to be more resilient
    // if a mcp server is down, the others will still work
    Object.entries(config.configs).forEach(([name, serverConfig]) => {
      this.mcpClients[name] = new MultiServerMCPClient({
        mcpServers: { [name]: serverConfig },
        ...config,
      });
    });
  }

  async loadTools(): Promise<McpServerRemoteTool[]> {
    const tools: McpServerRemoteTool[] = [];
    const errors: Array<{ server: string; error: Error }> = [];

    await Promise.all(
      Object.entries(this.mcpClients).map(async ([name, client]) => {
        try {
          const loadedTools = (await client.getTools()) ?? [];
          const extendedTools = loadedTools.map(
            tool => new McpServerRemoteTool({ tool, sourceId: name }),
          );
          tools.push(...extendedTools);
        } catch (error) {
          this.logger?.('Error', `Error loading tools for ${name}`, error as Error);
          errors.push({ server: name, error: error as Error });
        }
      }),
    );

    // Surface partial failures to provide better feedback
    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.server}: ${e.error.message}`).join('; ');
      this.logger?.(
        'Error',
        `Failed to load tools from ${errors.length}/${Object.keys(this.mcpClients).length} ` +
          `MCP server(s): ${errorMessage}`,
      );
    }

    return tools;
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
