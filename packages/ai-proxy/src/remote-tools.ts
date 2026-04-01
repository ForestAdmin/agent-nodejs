import type RemoteTool from './remote-tool';
import type { ResponseFormat } from '@langchain/core/tools';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { toJsonSchema } from '@langchain/core/utils/json_schema';

import { AIBadRequestError, AIToolNotFoundError, AIToolUnprocessableError } from './errors';

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

  async invokeTool(
    toolName: string,
    messages: ChatCompletionCreateParamsNonStreaming['messages'],
    sourceId?: string,
  ) {
    const matches = this.tools.filter(
      exTool => exTool.sanitizedName === toolName && (!sourceId || exTool.sourceId === sourceId),
    );

    if (matches.length === 0) throw new AIToolNotFoundError(`Tool ${toolName} not found`);

    if (matches.length > 1) {
      const sources = matches.map(t => t.sourceId || '<unknown>').join(', ');

      throw new AIBadRequestError(
        `Multiple tools found with name "${toolName}" (sources: ${sources}). ` +
          `Provide a source-id to disambiguate.`,
      );
    }

    try {
      return (await matches[0].base.invoke(messages)) as unknown;
    } catch (error) {
      throw new AIToolUnprocessableError(
        `Error while calling tool ${toolName}: ${(error as Error).message}`,
      );
    }
  }
}
