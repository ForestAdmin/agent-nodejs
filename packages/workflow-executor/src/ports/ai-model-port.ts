import type {
  BaseChatModel,
  McpServerLoadFailure,
  RemoteTool,
  ToolConfig,
} from '@forestadmin/ai-proxy';

export interface GetModelOptions {
  aiConfigName?: string;
  userId?: number;
}

export interface AiModelPort {
  getModel(options?: GetModelOptions): BaseChatModel;
  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]>;
  // Loads tools and exposes per-server failures classified by cause (auth vs connection), so the
  // OAuth path can tell a revoked token from an unreachable server. Default consumers use loadRemoteTools.
  loadRemoteToolsWithFailures(
    configs: Record<string, ToolConfig>,
  ): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }>;
  closeConnections(): Promise<void>;
}
