import type { AiModelPort } from './ports/ai-model-port';
import type { Logger } from './ports/logger-port';
import type { WorkflowPort } from './ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { isForestIntegrationConfig } from '@forestadmin/ai-proxy';

// Match by config.id, not by Record key: server names can collide across configs.
export function scopeConfigsToServer(
  configs: Record<string, ToolConfig>,
  mcpServerId: string,
): Record<string, ToolConfig> {
  return Object.fromEntries(Object.entries(configs).filter(([, cfg]) => cfg.id === mcpServerId));
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

  async fetch(mcpServerId?: string): Promise<RemoteTool[]> {
    const configs = await this.workflowPort.getMcpServerConfigs();
    const scoped = mcpServerId ? scopeConfigsToServer(configs, mcpServerId) : configs;

    if (mcpServerId) {
      this.warnUnidentifiedConfigs(configs, mcpServerId);
      this.warnMissingTargetServer(configs, scoped, mcpServerId);
    }

    if (Object.keys(scoped).length === 0) return [];

    const tools = await this.aiModelPort.loadRemoteTools(scoped);

    this.errorOnPartialLoadFailure(scoped, tools, mcpServerId);

    return tools;
  }

  // Configs without id cannot be matched against a defined mcpServerId. Surface them so a
  // partial PRD-360 migration doesn't masquerade as "wrong target server" downstream.
  private warnUnidentifiedConfigs(configs: Record<string, ToolConfig>, mcpServerId: string): void {
    const unidentifiedConfigNames = Object.entries(configs)
      .filter(([, cfg]) => cfg.id === undefined)
      .map(([name]) => name);

    if (unidentifiedConfigNames.length === 0) return;

    this.logger.warn('MCP configs without id cannot be scoped — check orchestrator migration', {
      requestedMcpServerId: mcpServerId,
      unidentifiedConfigNames,
    });
  }

  // Distinguish "no configs at all" (deployment misconfig) from "configs exist but none match"
  // (orchestrator/executor drift on server id) — both yield zero tools, but ops need to know
  // which one to fix.
  private warnMissingTargetServer(
    configs: Record<string, ToolConfig>,
    scoped: Record<string, ToolConfig>,
    mcpServerId: string,
  ): void {
    if (Object.keys(scoped).length > 0) return;

    const availableMcpServerIds = Object.values(configs)
      .map(cfg => cfg.id)
      .filter((id): id is string => Boolean(id));

    this.logger.warn(
      Object.keys(configs).length === 0
        ? 'MCP step targets a server but orchestrator returned no MCP configs'
        : 'MCP step targets a server not advertised by the orchestrator',
      { requestedMcpServerId: mcpServerId, availableMcpServerIds },
    );
  }

  // Partial-failure detection: McpClient swallows per-server load errors and returns whatever
  // succeeded. Compare scoped keys to the tools' sourceIds so ops can tell "wrong config" from
  // "MCP server down". Only valid for MCP configs — Forest integrations carry a hardcoded
  // sourceId (e.g. 'zendesk') that does not match the Record key, so any successfully-loaded
  // Forest connector keyed otherwise would always be flagged as failed.
  private errorOnPartialLoadFailure(
    scoped: Record<string, ToolConfig>,
    tools: RemoteTool[],
    mcpServerId: string | undefined,
  ): void {
    const loadedSourceIds = new Set(tools.map(t => t.sourceId));
    const failedConfigNames = Object.entries(scoped)
      .filter(([, cfg]) => !isForestIntegrationConfig(cfg))
      .map(([name]) => name)
      .filter(name => !loadedSourceIds.has(name));

    if (failedConfigNames.length === 0) return;

    this.logger.error('MCP servers failed to load tools', {
      requestedMcpServerId: mcpServerId ?? null,
      failedConfigNames,
    });
  }
}
