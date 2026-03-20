import type RemoteTool from '../../remote-tool';

import { BraveSearch } from '@langchain/community/tools/brave_search';

import ServerRemoteTool from '../../server-remote-tool';

export interface BraveConfig {
  apiKey: string;
}

export default function getBraveTools(config: BraveConfig): RemoteTool[] {
  return [
    new ServerRemoteTool({
      sourceId: 'brave_search',
      tool: new BraveSearch({ apiKey: config.apiKey }),
    }),
  ];
}
