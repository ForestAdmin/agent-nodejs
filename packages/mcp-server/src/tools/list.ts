import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import filterSchema from '../schemas/filter.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';

const listArgumentShape = {
  collectionName: z.string(),
  search: z.string().optional(),
  filters: filterSchema.optional(),
  sort: z
    .object({
      field: z.string(),
      ascending: z.boolean(),
    })
    .optional(),
};

const listArgumentSchema = z.object(listArgumentShape);
type ListArgument = z.infer<typeof listArgumentSchema>;

function getListParameters(options: ListArgument): {
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; ascending: boolean };
} {
  const parameters: {
    filters?: Record<string, unknown>;
    search?: string;
    sort?: { field: string; ascending: boolean };
  } = {};

  if (options.filters) {
    parameters.filters = { conditionTree: options.filters as Record<string, unknown> };
  }

  if (options.search) {
    parameters.search = options.search;
  }

  if (options.sort?.field && 'ascending' in options.sort) {
    parameters.sort = options.sort as { field: string; ascending: boolean };
  }

  return parameters;
}

export default function declareListTool(mcpServer: McpServer, forestServerUrl: string): void {
  mcpServer.registerTool(
    'list',
    {
      title: 'List data from the customer agent',
      description: 'Retrieve a list of data from the specified collection in the customer agent.',
      inputSchema: listArgumentShape,
    },
    async (options: ListArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      let actionType = 'index';

      if (options.search) {
        actionType = 'search';
      } else if (options.filters) {
        actionType = 'filter';
      }

      await createActivityLog(forestServerUrl, extra, actionType, {
        collectionName: options.collectionName,
      });

      const result = await rpcClient
        .collection(options.collectionName)
        .list(getListParameters(options));

      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );
}
