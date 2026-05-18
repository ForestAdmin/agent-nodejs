import type RemoteTool from '../../remote-tool';

import ServerRemoteTool from '../../server-remote-tool';
import createCortexAnalystTool from './tools/cortex-analyst';
import createCortexSearchTool from './tools/cortex-search';
import createExecuteQueryTool from './tools/execute-query';
import { getSnowflakeAuthHeaders, getSnowflakeBaseUrl } from './utils';

export interface SnowflakeConfig {
  accountIdentifier: string;
  programmaticAccessToken: string;
  defaultWarehouse?: string;
  defaultDatabase?: string;
  defaultSchema?: string;
  defaultRole?: string;
}

export default function getSnowflakeTools(config: SnowflakeConfig): RemoteTool[] {
  const headers = getSnowflakeAuthHeaders(config);
  const baseUrl = getSnowflakeBaseUrl(config.accountIdentifier);

  return [
    createCortexSearchTool(headers, baseUrl),
    createCortexAnalystTool(headers, baseUrl),
    createExecuteQueryTool(headers, baseUrl, config),
  ].map(
    tool =>
      new ServerRemoteTool({
        sourceId: 'snowflake',
        tool,
      }),
  );
}
