import { BraveSearch } from '@langchain/community/tools/brave_search';

import RemoteTool from '../../remote-tool';

export interface BraveConfig {
  apiKey: string;
}

export default function getBraveTools(config: BraveConfig): RemoteTool[] {
  return [
    new RemoteTool({
      sourceId: 'brave_search',
      sourceType: 'server',
      tool: new BraveSearch({ apiKey: config.apiKey }),
    }),
  ];
}
