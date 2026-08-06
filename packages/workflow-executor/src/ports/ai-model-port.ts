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
  // Loads tools and exposes per-server failures classified by cause (auth vs connection), so a
  // caller can tell a revoked token from an unreachable server and name it in its logs.
  loadRemoteToolsWithFailures(
    configs: Record<string, ToolConfig>,
  ): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }>;
  closeConnections(): Promise<void>;
}
