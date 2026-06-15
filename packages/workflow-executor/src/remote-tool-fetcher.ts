import type { AiModelPort } from './ports/ai-model-port';
import type { Logger } from './ports/logger-port';
import type { WorkflowPort } from './ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

// Match by config.id, not by Record key: server names can collide across configs.
export function scopeConfigsToServer(
  configs: Record<string, ToolConfig>,
  mcpServerId: string,
): Record<string, ToolConfig> {
  return Object.fromEntries(Object.entries(configs).filter(([, cfg]) => cfg.id === mcpServerId));
}

export interface FetchRemoteToolsResult {
  tools: RemoteTool[];
  mcpServerName?: string;
}

export default class RemoteToolFetcher {
  private readonly workflowPort: WorkflowPort;
  private readonly aiModelPort: AiModelPort;
  private readonly logger: Logger;

  constructor(workflowPort: WorkflowPort, aiModelPort: AiModelPort, logger: Logger) {
    this.workflowPort = workflowPort;
    this.aiModelPort = aiModelPort;
    this.logger = logger;
  }

  async fetch(mcpServerId: string): Promise<FetchRemoteToolsResult> {
    const configs = await this.workflowPort.getMcpServerConfigs();
    const scoped = scopeConfigsToServer(configs, mcpServerId);
    const [mcpServerName] = Object.keys(scoped);

    this.warnMissingTargetServer(configs, scoped, mcpServerId, mcpServerName);

    if (Object.keys(scoped).length === 0) return { tools: [], mcpServerName };

    const tools = await this.aiModelPort.loadRemoteTools(scoped);

    this.errorOnPartialLoadFailure(scoped, tools, mcpServerId, mcpServerName);

    return { tools, mcpServerName };
  }

  // Distinguish "no configs at all" (deployment misconfig) from "configs exist but none match"
  // (orchestrator/executor drift on server id) — both yield zero tools, but ops need to know
  // which one to fix.
  private warnMissingTargetServer(
    configs: Record<string, ToolConfig>,
    scoped: Record<string, ToolConfig>,
    mcpServerId: string,
    mcpServerName: string | undefined,
  ): void {
    if (Object.keys(scoped).length > 0) return;

    const availableMcpServerIds = Object.values(configs)
      .map(cfg => cfg.id)
      .filter((id): id is string => Boolean(id));

    this.logger(
      'Warn',
      Object.keys(configs).length === 0
        ? 'MCP step targets a server but orchestrator returned no MCP configs'
        : 'MCP step targets a server not advertised by the orchestrator',
      { requestedMcpServerId: mcpServerId, mcpServerName, availableMcpServerIds },
    );
  }

  // Partial-failure detection: McpClient swallows per-server load errors and returns whatever
  // succeeded. Match config.id against tool.mcpServerId — both providers populate it from the
  // orchestrator's persisted id, so the check is uniform across MCP and Forest connectors.
  private errorOnPartialLoadFailure(
    scoped: Record<string, ToolConfig>,
    tools: RemoteTool[],
    mcpServerId: string,
    mcpServerName: string | undefined,
  ): void {
    const loadedMcpServerIds = new Set(tools.map(t => t.mcpServerId));
    const failedConfigNames = Object.entries(scoped)
      .filter(([, cfg]) => !loadedMcpServerIds.has(cfg.id))
      .map(([name]) => name);

    if (failedConfigNames.length === 0) return;

    this.logger('Error', 'MCP servers failed to load tools', {
      requestedMcpServerId: mcpServerId,
      mcpServerName,
      failedConfigNames,
    });
  }
}
