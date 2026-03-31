import type RemoteTool from './remote-tool';
import type { ResponseFormat } from '@langchain/core/tools';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { toJsonSchema } from '@langchain/core/utils/json_schema';

import { AIToolNotFoundError, AIToolUnprocessableError } from './errors';

export type Messages = ChatCompletionCreateParamsNonStreaming['messages'];

export class RemoteTools {
  readonly tools: RemoteTool[];

  constructor(tools?: RemoteTool[]) {
    this.tools = tools ?? [];
  }

  get toolDefinitionsForFrontend() {
    return this.tools.map(extendedTool => {
      return {
        name: extendedTool.sanitizedName,
        description: extendedTool.base.description,
        responseFormat: 'content' as ResponseFormat,
        schema: toJsonSchema(extendedTool.base.schema),
        sourceId: extendedTool.sourceId,
        sourceType: extendedTool.sourceType,
      };
    });
  }

  async invokeTool(toolName: string, messages: ChatCompletionCreateParamsNonStreaming['messages']) {
    const extendedTool = this.tools.find(exTool => exTool.sanitizedName === toolName);

    if (!extendedTool) throw new AIToolNotFoundError(`Tool ${toolName} not found`);

    try {
      return (await extendedTool.base.invoke(messages)) as unknown;
    } catch (error) {
      throw new AIToolUnprocessableError(
        `Error while calling tool ${toolName}: ${(error as Error).message}`,
      );
    }
  }
}
