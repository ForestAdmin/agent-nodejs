import type { McpConfiguration } from './mcp-client';

import McpConfigChecker from './mcp-config-checker';

export { createAiProvider } from './create-ai-provider';
// Re-export from provider-dispatcher (excluding isModelSupportingTools - internal only)
export { ProviderDispatcher } from './provider-dispatcher';
export type {
  AiConfiguration,
  AiProvider,
  BaseAiConfiguration,
  ChatCompletionMessage,
  ChatCompletionResponse,
  ChatCompletionTool,
  ChatCompletionToolChoice,
  DispatchBody,
  OpenAiConfiguration,
} from './provider-dispatcher';
export * from './remote-tools';
export * from './router';
export * from './mcp-client';
export * from './oauth-token-injector';
export * from './errors';

export function validMcpConfigurationOrThrow(mcpConfig: McpConfiguration) {
  return McpConfigChecker.check(mcpConfig);
}
