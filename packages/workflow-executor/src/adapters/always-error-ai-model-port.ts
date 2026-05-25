import type { AiModelPort } from '../ports/ai-model-port';
import type { McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AiModelPortError } from '../errors';

// Dev-only adapter: every AI call throws immediately so devs can reproduce AI error paths
// without a real AI service. Activated via WORKFLOW_EXECUTOR_FORCE_AI_ERROR=true.
export default class AlwaysErrorAiModelPort implements AiModelPort {
  getModel(): BaseChatModel {
    return {
      bindTools: () => ({
        invoke: () =>
          Promise.reject(
            new AiModelPortError('invoke', new Error('[dev] AI forced to always error')),
          ),
      }),
    } as unknown as BaseChatModel;
  }

  loadRemoteTools(_config: McpConfiguration): Promise<RemoteTool[]> {
    return Promise.resolve([]);
  }

  closeConnections(): Promise<void> {
    return Promise.resolve();
  }
}
