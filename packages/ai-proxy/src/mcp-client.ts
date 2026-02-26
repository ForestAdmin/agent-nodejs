import type { Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { McpConnectionError } from './errors';
import McpServerRemoteTool from './mcp-server-remote-tool';

export type McpServerConfig = MultiServerMCPClient['config']['mcpServers'][string];

const UNREACHABLE_ERROR_CODES: string[] = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
];

function isServerUnreachable(error: Error): boolean {
  const { code } = error as NodeJS.ErrnoException;

  return !!code && UNREACHABLE_ERROR_CODES.includes(code);
}

function getLogLevelForError(error: Error): LoggerLevel {
  return isServerUnreachable(error) ? 'Warn' : 'Error';
}

export type McpConfiguration = {
  configs: MultiServerMCPClient['config']['mcpServers'];
} & Omit<MultiServerMCPClient['config'], 'mcpServers'>;

export default class McpClient {
  private readonly mcpClients: Record<string, MultiServerMCPClient> = {};
  private readonly logger?: Logger;

  readonly tools: McpServerRemoteTool[] = [];

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
    const errors: Array<{ server: string; error: Error }> = [];

    await Promise.all(
      Object.entries(this.mcpClients).map(async ([name, client]) => {
        try {
          const tools = (await client.getTools()) ?? [];
          const extendedTools = tools.map(
            tool => new McpServerRemoteTool({ tool, sourceId: name }),
          );
          this.tools.push(...extendedTools);
        } catch (error) {
          const logLevel = getLogLevelForError(error as Error);
          this.logger?.(logLevel, `Error loading tools for ${name}`, error as Error);
          errors.push({ server: name, error: error as Error });
        }
      }),
    );

    // Surface partial failures to provide better feedback
    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.server}: ${e.error.message}`).join('; ');
      const allConnectionErrors = errors.every(e => isServerUnreachable(e.error));
      const summaryLogLevel = allConnectionErrors ? 'Warn' : 'Error';
      this.logger?.(
        summaryLogLevel,
        `Failed to load tools from ${errors.length}/${Object.keys(this.mcpClients).length} ` +
          `MCP server(s): ${errorMessage}`,
      );
    }

    return this.tools;
  }

  async testConnections(): Promise<true> {
    try {
      await Promise.all(
        Object.values(this.mcpClients).map(client => client.initializeConnections()),
      );

      return true;
    } catch (error) {
      throw new McpConnectionError((error as Error).message);
    } finally {
      try {
        await this.closeConnections();
      } catch (cleanupError) {
        // Log but don't throw - we don't want to mask the original connection error
        const logLevel = getLogLevelForError(cleanupError as Error);
        this.logger?.(logLevel, 'Error during test connection cleanup', cleanupError as Error);
      }
    }
  }

  async closeConnections(): Promise<void> {
    const entries = Object.entries(this.mcpClients);
    const results = await Promise.allSettled(entries.map(([, client]) => client.close()));

    // Check for failures but don't throw - cleanup should be best-effort
    const failures = results
      .map((result, index) => ({ result, name: entries[index][0] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      failures.forEach(({ name, result }) => {
        const error = (result as PromiseRejectedResult).reason;
        const logLevel = getLogLevelForError(error);
        this.logger?.(logLevel, `Failed to close MCP connection for ${name}`, error);
      });
      const allConnectionErrors = failures.every(({ result }) =>
        isServerUnreachable((result as PromiseRejectedResult).reason),
      );
      const summaryLogLevel = allConnectionErrors ? 'Warn' : 'Error';
      this.logger?.(
        summaryLogLevel,
        `Failed to close ${failures.length}/${results.length} MCP connections. ` +
          `This may result in resource leaks.`,
      );
    }
  }
}
