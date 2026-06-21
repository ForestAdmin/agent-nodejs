import type { McpPermissionResolver } from './mcp-permission-resolver';
import type {
  CanExecuteOperation,
  CanExecuteVerdict,
  ExecuteToolRequest,
  ListToolsResult,
  RegisteredTool,
  ToolResult,
} from './types';
import type { AiModelPort } from '../ports/ai-model-port';
import type { Logger } from '../ports/logger-port';
import type { WorkflowPort } from '../ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { toJsonSchema } from '@forestadmin/ai-proxy';

import { McpNeedsConsentError, McpServerUnavailableError, McpUnknownToolError } from './errors';
import { scopeConfigsToServer } from '../remote-tool-fetcher';

export interface McpExecutionServiceDeps {
  workflowPort: WorkflowPort;
  aiModelPort: AiModelPort;
  permissionResolver: McpPermissionResolver;
  logger: Logger;
}

// Stateless MCP plane: discovery + execution + authorization-query against the project's configured
// third-party MCP integrations. No run/step/runId coupling — uses only run-agnostic ports.
export default class McpExecutionService {
  private readonly workflowPort: WorkflowPort;
  private readonly aiModelPort: AiModelPort;
  private readonly permissionResolver: McpPermissionResolver;
  private readonly logger: Logger;

  constructor(deps: McpExecutionServiceDeps) {
    this.workflowPort = deps.workflowPort;
    this.aiModelPort = deps.aiModelPort;
    this.permissionResolver = deps.permissionResolver;
    this.logger = deps.logger;
  }

  async listTools(userId: number, mcpServerIds?: string[]): Promise<ListToolsResult> {
    const configs = await this.workflowPort.getMcpServerConfigs();
    const scoped = this.scope(configs, mcpServerIds);
    const credentialed = await this.applyCredentials(userId, scoped);
    const tools = await this.aiModelPort.loadRemoteTools(credentialed);

    return {
      tools: tools.map(tool => this.toRegisteredTool(tool)),
      serverErrors: this.classifyMissingServers(scoped, tools),
    };
  }

  async executeTool(userId: number, req: ExecuteToolRequest): Promise<ToolResult> {
    const { mcpServerId, toolName, args } = req;
    const configs = await this.workflowPort.getMcpServerConfigs();
    const scoped = scopeConfigsToServer(configs, mcpServerId);

    if (Object.keys(scoped).length === 0) throw new McpUnknownToolError(mcpServerId, toolName);

    const credentialed = await this.applyCredentials(userId, scoped);
    const tools = await this.aiModelPort.loadRemoteTools(credentialed);

    // No tools from a configured server means it couldn't be authenticated/reached — the dominant
    // cause being a missing credential (resolved here once PRD-367 lands).
    if (tools.length === 0) throw new McpNeedsConsentError(mcpServerId);

    const tool = tools.find(t => t.base.name === toolName || t.sanitizedName === toolName);
    if (!tool) throw new McpUnknownToolError(mcpServerId, toolName);

    try {
      // PRD-367 seam: on a 401 from upstream, force-refresh the token here and retry once.
      return await tool.base.invoke(args as Record<string, unknown>);
    } catch (cause) {
      throw new McpServerUnavailableError(mcpServerId, cause);
    }
  }

  async canExecute(
    userId: number,
    operations: CanExecuteOperation | CanExecuteOperation[],
  ): Promise<CanExecuteVerdict[]> {
    const list = Array.isArray(operations) ? operations : [operations];

    return Promise.all(list.map(op => this.permissionResolver.resolve(userId, op)));
  }

  private scope(
    configs: Record<string, ToolConfig>,
    mcpServerIds?: string[],
  ): Record<string, ToolConfig> {
    if (!mcpServerIds?.length) return configs;

    const wanted = new Set(mcpServerIds);

    return Object.fromEntries(
      Object.entries(configs).filter(([, cfg]) => cfg.id !== undefined && wanted.has(cfg.id)),
    );
  }

  private toRegisteredTool(tool: RemoteTool): RegisteredTool {
    const mcpServerId = tool.mcpServerId ?? tool.sourceId;

    return {
      name: `${mcpServerId}.${tool.base.name}`,
      inputSchema: toJsonSchema(tool.base.schema),
      mcpServerId,
    };
  }

  // A configured server that produced no tools failed to load — surfaced per-server so one bad
  // integration never breaks discovery of the others. Reason is provisional until PRD-367 can tell
  // "needs-consent" apart from "unsupported"/"config-error".
  private classifyMissingServers(
    scoped: Record<string, ToolConfig>,
    tools: RemoteTool[],
  ): ListToolsResult['serverErrors'] {
    const loaded = new Set(tools.map(t => t.mcpServerId));

    return Object.values(scoped)
      .filter(cfg => cfg.id !== undefined && !loaded.has(cfg.id))
      .map(cfg => ({ mcpServerId: cfg.id as string, reason: 'needs-consent' as const }));
  }

  // PRD-367 seam: resolve per-user credentials from the executor vault and inject them into the
  // configs before loading tools. Until then configs flow through unchanged.
  private async applyCredentials(
    _userId: number,
    configs: Record<string, ToolConfig>,
  ): Promise<Record<string, ToolConfig>> {
    return configs;
  }
}
