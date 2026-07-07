import type { ForestServerClient } from './http-client';
import type { InProcessAgentDispatcher } from './in-process-agent-dispatcher';
import type { Logger } from './server';

export interface ToolContext {
  forestServerClient: ForestServerClient;
  logger: Logger;
  collectionNames: string[];
  // Present only when the MCP server is mounted in an agent — tool calls then dispatch in-process.
  agentDispatcher?: InProcessAgentDispatcher;
}
