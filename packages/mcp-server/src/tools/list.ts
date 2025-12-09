import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import filterSchema from '../schemas/filter.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';

function createListArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    search: z.string().optional(),
    filters: filterSchema.optional(),
    sort: z
      .object({
        field: z.string(),
        ascending: z.boolean(),
      })
      .optional(),
  };
}

type ListArgument = {
  collectionName: string;
  search?: string;
  filters?: z.infer<typeof filterSchema>;
  sort?: { field: string; ascending: boolean };
};

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

export default function declareListTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  collectionNames: string[] = [],
): void {
  const listArgumentShape = createListArgumentShape(collectionNames);

  mcpServer.registerTool(
    'list',
    {
      title: 'List records from a collection',
      description: 'Retrieve a list of records from the specified collection.',
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
