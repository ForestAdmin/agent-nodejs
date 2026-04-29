import type RemoteTool from '../../remote-tool';

import ServerRemoteTool from '../../server-remote-tool';
import createCortexAnalystTool from './tools/cortex-analyst';
import createCortexSearchTool from './tools/cortex-search';
import createExecuteQueryTool from './tools/execute-query';
import { getSnowflakeAuthHeaders } from './utils';

export interface SnowflakeConfig {
  accountIdentifier: string;
  programmaticAccessToken: string;
  defaultWarehouse?: string;
  defaultDatabase?: string;
  defaultSchema?: string;
  defaultRole?: string;
}

export function buildSnowflakeBaseUrl(config: SnowflakeConfig): string {
  return `https://${config.accountIdentifier}.snowflakecomputing.com`;
}

export default function getSnowflakeTools(config: SnowflakeConfig): RemoteTool[] {
  const headers = getSnowflakeAuthHeaders(config);
  const baseUrl = buildSnowflakeBaseUrl(config);

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
