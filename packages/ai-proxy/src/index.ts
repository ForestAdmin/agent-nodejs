import type { McpConfiguration } from './mcp-client';

import McpConfigChecker from './mcp-config-checker';

export { createAiProvider } from './create-ai-provider';
export { createBaseChatModel } from './create-base-chat-model';
export { default as ProviderDispatcher } from './provider-dispatcher';
export * from './provider-dispatcher';
export * from './ai-client';
export * from './remote-tools';
export { default as RemoteTool } from './remote-tool';
export * from './router';
export * from './mcp-client';
export * from './oauth-token-injector';
export * from './errors';

export function validMcpConfigurationOrThrow(mcpConfig: McpConfiguration) {
  return McpConfigChecker.check(mcpConfig);
}

export type { BaseChatModel } from '@langchain/core/language_models/chat_models';
export type { BaseMessage } from '@langchain/core/messages';
export { HumanMessage, SystemMessage } from '@langchain/core/messages';
export type { StructuredToolInterface } from '@langchain/core/tools';
export { DynamicStructuredTool } from '@langchain/core/tools';
