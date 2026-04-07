import type { AiModelPort } from '../src/ports/ai-model-port';
import type { McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

// eslint-disable-next-line import/no-extraneous-dependencies
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { AI_RESPONSES } from './scenario';

function createMockModel(stepIndex: number): BaseChatModel {
  const response = AI_RESPONSES[stepIndex];

  const invoke = async () => {
    if (!response) return { tool_calls: undefined };

    return {
      tool_calls: [{ name: response.toolName, args: response.args, id: `call-${stepIndex}` }],
    };
  };

  // Minimal mock that satisfies BaseChatModel usage in base-step-executor:
  // model.bindTools(tools, opts) returns model-like object with invoke()
  const model = {
    invoke,
    bindTools() {
      return this;
    },
  };

  return model as unknown as BaseChatModel;
}

function createMockRemoteTool(): RemoteTool {
  const tool = new DynamicStructuredTool({
    name: 'mock_search',
    description: 'Search for information about a topic',
    schema: z.object({ query: z.string().describe('Search query') }),
    func: async (input: { query: string }) => {
      // eslint-disable-next-line no-console
      console.log(`  [mcp] mock_search("${input.query}")`);

      return JSON.stringify({
        results: [{ title: 'Customer Profile', snippet: 'VIP customer since 2024' }],
      });
    },
  });

  return {
    base: tool,
    sourceId: 'mock-server',
    sourceType: 'mcp-server',
    get sanitizedName() {
      return tool.name;
    },
  } as unknown as RemoteTool;
}

/**
 * Mock AI model port that returns deterministic responses from AI_RESPONSES.
 * Reads the current step index from an external getter (linked to MockWorkflowPort)
 * so re-polling the same step always returns the same AI response.
 */
export default class MockAiModelPort implements AiModelPort {
  private readonly getCurrentStepIndex: () => number;

  constructor(getCurrentStepIndex: () => number) {
    this.getCurrentStepIndex = getCurrentStepIndex;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getModel(_aiConfigName?: string): BaseChatModel {
    return createMockModel(this.getCurrentStepIndex());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadRemoteTools(_config: McpConfiguration): Promise<RemoteTool[]> {
    return [createMockRemoteTool()];
  }

  async closeConnections(): Promise<void> {
    // no-op
  }
}
