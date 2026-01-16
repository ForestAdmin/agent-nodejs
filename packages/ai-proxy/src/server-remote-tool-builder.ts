import { BraveSearch } from '@langchain/community/tools/brave_search';

import ServerRemoteTool from './server-remote-tool';

export type BraveApiKey = { ['AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY']: string };

export type ServerRemoteToolsApiKeys = BraveApiKey | Record<string, string>; // To avoid to cast the object because env is not always well typed from the caller

export default class ServerRemoteToolBuilder {
  static buildTools(apiKeys?: ServerRemoteToolsApiKeys) {
    const tools: ServerRemoteTool[] = [];
    this.addBrave(apiKeys, tools);
    // TODO: slack, infogreffe etc. tools will be built here.

    return tools;
  }

  private static addBrave(apiKeys: ServerRemoteToolsApiKeys, tools: ServerRemoteTool[]) {
    if (apiKeys?.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY) {
      tools.push(
        new ServerRemoteTool({
          sourceId: 'brave_search',
          tool: new BraveSearch({ apiKey: apiKeys.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY }),
        }),
      );
    }
  }
}
