import type RemoteTool from '../../remote-tool';

import createGetEntityProfileTool from './tools/get-entity-profile';
import createGetScreeningResultTool from './tools/get-screening-result';
import createListPendingReviewsTool from './tools/list-pending-reviews';
import createScreenTransactionTool from './tools/screen-transaction';
import createUpdateDecisionTool from './tools/update-decision';
import { getKolarConfig } from './utils';
import ServerRemoteTool from '../../server-remote-tool';

export interface KolarConfig {
  username: string;
  password: string;
}

export default function getKolarTools(config: KolarConfig): RemoteTool[] {
  const { baseUrl, headers } = getKolarConfig(config);

  return [
    createScreenTransactionTool(headers, baseUrl),
    createGetScreeningResultTool(headers, baseUrl),
    createUpdateDecisionTool(headers, baseUrl),
    createListPendingReviewsTool(headers, baseUrl),
    createGetEntityProfileTool(headers, baseUrl),
  ].map(
    tool =>
      new ServerRemoteTool({
        sourceId: 'kolar',
        tool,
      }),
  );
}
