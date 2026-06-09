import type { AiModelPort } from '../ports/ai-model-port';
import type { BaseChatModel, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { AiModelPortError } from '../errors';

// Dev-only adapter: every AI call throws immediately so devs can reproduce AI error paths
// without a real AI service. Activated via FORCE_AI_ERROR=true.
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadRemoteTools(_configs: Record<string, ToolConfig>): Promise<RemoteTool[]> {
    return Promise.resolve([]);
  }

  closeConnections(): Promise<void> {
    return Promise.resolve();
  }
}
