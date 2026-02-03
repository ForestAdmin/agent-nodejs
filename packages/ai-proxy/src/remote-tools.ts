import type RemoteTool from './remote-tool';
import type { ResponseFormat } from '@langchain/core/tools';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { BraveSearch } from '@langchain/community/tools/brave_search';
import { toJsonSchema } from '@langchain/core/utils/json_schema';

import { AIToolNotFoundError, AIToolUnprocessableError } from './errors';
import ServerRemoteTool from './server-remote-tool';

export type Messages = ChatCompletionCreateParamsNonStreaming['messages'];

export type RemoteToolsApiKeys =
  | { ['AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY']: string }
  | Record<string, string>; // To avoid to cast the object because env is not always well typed from the caller

export class RemoteTools {
  private readonly apiKeys?: RemoteToolsApiKeys;
  readonly tools: RemoteTool[] = [];

  constructor(apiKeys: RemoteToolsApiKeys, tools?: RemoteTool[]) {
    this.apiKeys = apiKeys;
    this.tools.push(...(tools ?? []));

    if (this.apiKeys?.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY) {
      this.tools.push(
        new ServerRemoteTool({
          sourceId: 'brave_search',
          tool: new BraveSearch({ apiKey: this.apiKeys.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY }),
        }),
      );
    }
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
