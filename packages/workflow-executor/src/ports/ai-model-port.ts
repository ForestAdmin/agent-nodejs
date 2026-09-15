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
  // Optional so the 40-odd test doubles of this port stay valid: only the real adapter has a
  // credential chain to resolve, and Runner treats its absence as "nothing to verify".
  probeCredentials?(): Promise<void>;
  closeConnections(): Promise<void>;
}
