import type { Logger } from '@forestadmin/datasource-toolkit';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { McpConnectionError } from './types/errors';
import McpServerRemoteTool from './types/mcp-server-remote-tool';

export type McpAuthenticationType = 'none' | 'bearer' | 'oauth2';

export type McpConfiguration = {
  configs: MultiServerMCPClient['config']['mcpServers'];
  authenticationTypes?: Record<string, McpAuthenticationType>;
} & Omit<MultiServerMCPClient['config'], 'mcpServers'>;

export default class McpClient {
  private readonly mcpClients: Record<string, MultiServerMCPClient> = {};
  private readonly authenticationTypes: Record<string, McpAuthenticationType>;
  private readonly logger?: Logger;

  readonly tools: McpServerRemoteTool[] = [];

  constructor(config: McpConfiguration, logger?: Logger, mcpOauthTokens?: Record<string, string>) {
    this.logger = logger;
    this.authenticationTypes = config.authenticationTypes ?? {};
    // split the config into several clients to be more resilient
    // if a mcp server is down, the others will still work
    Object.entries(config.configs).forEach(([name, serverConfig]) => {
      const token = mcpOauthTokens?.[name];
      const configWithToken = this.injectOauthToken(serverConfig, token);
      this.mcpClients[name] = new MultiServerMCPClient({
        mcpServers: { [name]: configWithToken },
        ...config,
      });
    });
  }

  /**
   * Injects the OAuth token as Authorization header into HTTP-based transport configurations.
   * The frontend sends 'x-mcp-oauth-tokens' with tokens keyed by server name.
   * For stdio transports, returns the config unchanged.
   */
  private injectOauthToken(
    serverConfig: MultiServerMCPClient['config']['mcpServers'][string],
    token?: string,
  ): MultiServerMCPClient['config']['mcpServers'][string] {
    if (!token) return serverConfig;

    // Only inject token for HTTP-based transports (sse, http)
    if (serverConfig.type === 'http') {
      const { oauthConfig, ...headers } = serverConfig.headers || {};

      return {
        ...serverConfig,
        headers: {
          ...headers,
          Authorization: token,
        },
      };
    }

    return serverConfig;
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

    return this.tools;
  }

  async testConnections(): Promise<true> {
    try {
      await Promise.all(
        Object.entries(this.mcpClients).map(async ([name, client]) => {
          const isOAuth = this.authenticationTypes[name] === 'oauth2';

          try {
            await client.initializeConnections();
          } catch (error) {
            // For OAuth servers without a token, we expect auth errors (401/403)
            // The server is reachable, just not authenticated yet
            if (isOAuth && this.isAuthenticationError(error)) {
              this.logger?.(
                'Info',
                `OAuth server ${name} is reachable (authentication will be required)`,
              );

              return;
            }

            throw error;
          }
        }),
      );

      return true;
    } catch (error) {
      throw new McpConnectionError((error as Error).message);
    } finally {
      try {
        await this.closeConnections();
      } catch (cleanupError) {
        // Log but don't throw - we don't want to mask the original connection error
        this.logger?.('Error', 'Error during test connection cleanup', cleanupError as Error);
      }
    }
  }

  /**
   * Checks if an error is an authentication error (401/403).
   * These errors indicate the server is reachable but requires authentication.
   */
  private isAuthenticationError(error: unknown): boolean {
    const message = (error as Error)?.message?.toLowerCase() ?? '';

    return (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
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
