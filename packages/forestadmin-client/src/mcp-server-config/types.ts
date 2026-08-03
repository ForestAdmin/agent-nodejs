export type ToolConfig = Record<string, unknown>;

export interface McpServerConfigService {
  getConfiguration(): Promise<Record<string, ToolConfig>>;
}
