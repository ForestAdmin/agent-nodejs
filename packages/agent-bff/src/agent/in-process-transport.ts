import type { AgentTransport } from './agent-transport';
import type { AgentDispatcher } from '@forestadmin/agent-client';

import { IN_PROCESS_AGENT_URL, InProcessHttpRequester } from '@forestadmin/agent-client';

import { streamingUnsupported } from '../http/bff-local-errors';

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
  return {
    url: IN_PROCESS_AGENT_URL,
    createRequester: token => {
      const requester = new InProcessHttpRequester(token, dispatcher, {
        defaultTimeoutMs: timeoutMs,
      });

      // A typed 501 rather than a raw Error, so the day a route does reach here the client is told
      // what is missing instead of being sent looking for a network the request never crossed.
      requester.stream = async () => {
        throw streamingUnsupported('Streaming is not supported over the in-process transport');
      };

      return requester;
    },
  };
}
