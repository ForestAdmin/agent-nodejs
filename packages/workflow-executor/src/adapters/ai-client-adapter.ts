import type { AiModelPort, GetModelOptions } from '../ports/ai-model-port';
import type { Logger } from '../ports/logger-port';
import type {
  AiConfiguration,
  BaseChatModel,
  McpServerLoadFailure,
  RemoteTool,
  ToolConfig,
} from '@forestadmin/ai-proxy';

import { AiClient } from '@forestadmin/ai-proxy';

import { AiCredentialProbeError, AiModelPortError, WorkflowExecutorError } from '../errors';
import toAiProxyLogger from './to-ai-proxy-logger';

export default class AiClientAdapter implements AiModelPort {
  private readonly aiClient: AiClient;

  constructor(aiConfigurations: AiConfiguration[], logger?: Logger) {
    const withRetries = aiConfigurations.map(c => ({ maxRetries: 2, ...c }));
    this.aiClient = new AiClient({
      aiConfigurations: withRetries as AiConfiguration[],
      logger: logger ? toAiProxyLogger(logger) : undefined,
    });
  }

  getModel({ aiConfigName }: GetModelOptions = {}): BaseChatModel {
    try {
      return this.aiClient.getModel(aiConfigName);
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AiModelPortError('getModel', cause);
    }
  }

  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]> {
    return this.callPort('loadRemoteTools', () => this.aiClient.loadRemoteTools(configs));
  }

  loadRemoteToolsWithFailures(
    configs: Record<string, ToolConfig>,
  ): Promise<{ tools: RemoteTool[]; failures: McpServerLoadFailure[] }> {
    return this.callPort('loadRemoteToolsWithFailures', () =>
      this.aiClient.loadRemoteToolsWithFailures(configs),
    );
  }

  // Deliberately not through callPort: this runs at boot, so an AiModelPortError would reframe a
  // container misconfiguration as a transient AI outage and bury the provider's own sentence —
  // the only actionable part — behind "The AI service is unavailable. Please try again."
  async probeCredentials(): Promise<void> {
    try {
      await this.aiClient.probeCredentials();
    } catch (cause) {
      throw new AiCredentialProbeError(cause instanceof Error ? cause.message : String(cause), {
        cause,
      });
    }
  }

  closeConnections(): Promise<void> {
    return this.callPort('closeConnections', () => this.aiClient.closeConnections());
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AiModelPortError(operation, cause);
    }
  }
}
