import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { readFileSync } from 'fs';
import path from 'path';

export const RECORDS_VIEW_URI = 'ui://forest/records';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

const RECORDS_VIEW_NAME = 'forest-records-view';
const RECORDS_VIEW_FILE = path.join(__dirname, 'records-view.html');
const LEGACY_RESOURCE_URI_META_KEY = 'ui/resourceUri';

export const RECORDS_VIEW_DESCRIPTION =
  ' The client shows the returned records to the user in an interactive table: do not repeat them as a table or a list in your reply, answer with a short summary or the insight the user asked for.';
export const RECORDS_VIEW_NOTE =
  'These records are already displayed to the user in an interactive table. Do not repeat them as a table or a list; reply with a short summary or the insight asked for.';

export interface McpApps {
  recordsViewHtml: string;
}

export function loadMcpApps(htmlFile = RECORDS_VIEW_FILE): McpApps {
  try {
    return { recordsViewHtml: readFileSync(htmlFile, 'utf8') };
  } catch (error) {
    throw new Error(
      `MCP Apps are enabled but the records view could not be read from "${htmlFile}" ` +
        `(${(error as Error).message}). Reinstall @forestadmin/mcp-server, or turn MCP Apps off.`,
    );
  }
}

export function recordsResultContent(
  response: unknown,
  apps: McpApps | undefined,
): Array<{ type: 'text'; text: string }> {
  const content = [{ type: 'text' as const, text: JSON.stringify(response) }];

  return apps ? [...content, { type: 'text' as const, text: RECORDS_VIEW_NOTE }] : content;
}

function recordsViewToolMeta(): Record<string, unknown> {
  return {
    ui: { resourceUri: RECORDS_VIEW_URI },
    [LEGACY_RESOURCE_URI_META_KEY]: RECORDS_VIEW_URI,
  };
}

export function recordsToolConfig(
  description: string,
  apps: McpApps | undefined,
): { description: string; _meta?: Record<string, unknown> } {
  if (!apps) return { description };

  return { description: `${description}${RECORDS_VIEW_DESCRIPTION}`, _meta: recordsViewToolMeta() };
}

export function registerRecordsView(mcpServer: McpServer, apps: McpApps): void {
  mcpServer.registerResource(
    RECORDS_VIEW_NAME,
    RECORDS_VIEW_URI,
    {
      title: 'Forest Admin records',
      description: 'Interactive table of the records returned by list and listRelated.',
      mimeType: MCP_APP_MIME_TYPE,
    },
    async () => ({
      contents: [
        { uri: RECORDS_VIEW_URI, mimeType: MCP_APP_MIME_TYPE, text: apps.recordsViewHtml },
      ],
    }),
  );
}
