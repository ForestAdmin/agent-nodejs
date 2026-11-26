import type { AgentTransport } from './agent-transport';
import type { AgentDispatcher } from '@forestadmin/agent-client';

import { IN_PROCESS_AGENT_URL } from '@forestadmin/agent-client';

export { AGENT_DISPATCH_TIMEOUT_CODE, IN_PROCESS_AGENT_URL } from '@forestadmin/agent-client';
export type {
  AgentDispatcher,
  AgentDispatchRequest,
  AgentDispatchResponse,
} from '@forestadmin/agent-client';

export interface InProcessTransportOptions {
  dispatcher: AgentDispatcher;
  timeoutMs?: number;
}

export default function createInProcessTransport({
  dispatcher,
  timeoutMs,
}: InProcessTransportOptions): AgentTransport {
  return { url: IN_PROCESS_AGENT_URL, dispatcher, timeoutMs };
}
