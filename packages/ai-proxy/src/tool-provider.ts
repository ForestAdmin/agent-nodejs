import type { McpServerLoadFailure } from './mcp-client';
import type RemoteTool from './remote-tool';

export interface ToolProvider {
  loadTools(): Promise<RemoteTool[]>;
  // Optional richer variant: providers that can classify per-server failures expose them here.
  loadToolsWithFailures?(): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }>;
  checkConnection(): Promise<true>;
  dispose(): Promise<void>;
}
