import type { ForestServerClient } from './http-client';
import type { InProcessAgentDispatcher } from './in-process-agent-dispatcher';
import type { Logger } from './server';

export interface ToolContext {
  forestServerClient: ForestServerClient;
  logger: Logger;
  collectionNames: string[];
  agentDispatcher?: InProcessAgentDispatcher;
}
