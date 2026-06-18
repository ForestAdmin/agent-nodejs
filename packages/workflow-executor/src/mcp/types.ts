// Wire shapes for the executor's /mcp/* route group (PRD-514). Decoupled from runs — these never
// reference runId/step/run state.

export interface RegisteredTool {
  // Namespaced as `${mcpServerId}.${toolName}` so the gateway never re-derives it.
  name: string;
  inputSchema: unknown;
  mcpServerId: string;
}

export type McpServerErrorReason = 'needs-consent' | 'unsupported' | 'config-error';

export interface McpServerError {
  mcpServerId: string;
  reason: McpServerErrorReason;
}

export interface ListToolsResult {
  tools: RegisteredTool[];
  serverErrors: McpServerError[];
}

export interface ExecuteToolRequest {
  mcpServerId: string;
  toolName: string;
  args: unknown;
}

export type ToolResult = unknown;

// "Operation" (not "action") — Forest reserves "action" for Smart Actions.
export type CanExecuteOperation =
  | { kind: 'list' }
  | { kind: 'tool'; mcpServerId: string; toolName: string };

export interface CanExecuteVerdict {
  allowed: boolean;
  reason?: string;
}
