import type RemoteTool from '../../remote-tool';

import createMerchantApplicationTool from './tools/create-merchant-application';
import createGetMerchantApplicationResultTool from './tools/get-merchant-application-result';
import createGetScreeningResultTool from './tools/get-screening-result';
import createScreenTransactionTool from './tools/screen-transaction';
import { getKolarConfig } from './utils';
import ServerRemoteTool from '../../server-remote-tool';

export interface KolarConfig {
  apiKey: string;
}

export default function getKolarTools(config: KolarConfig): RemoteTool[] {
  const { baseUrl, headers } = getKolarConfig(config);

  return [
    createMerchantApplicationTool(headers, baseUrl),
    createGetMerchantApplicationResultTool(headers, baseUrl),
    createScreenTransactionTool(headers, baseUrl),
    createGetScreeningResultTool(headers, baseUrl),
  ].map(
    tool =>
      new ServerRemoteTool({
        sourceId: 'kolar',
        tool,
      }),
  );
}
