import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import toToolError from '../utils/tool-error';
import registerToolWithLogging from '../utils/tool-with-logging';

interface DeleteArgument {
  collectionName: string;
  recordIds: (string | number)[];
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    recordIds: z
      .array(z.union([z.string(), z.number()]))
      .describe('The IDs of the records to delete.'),
  };
}

export default function declareDeleteTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { logger, collectionNames } = ctx;
  const argumentShape = createArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'delete',
    {
      title: 'Delete records',
      description: 'Delete one or more records from the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: DeleteArgument, extra) => {
      const { rpcClient } = buildClient(extra, ctx);

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = options.recordIds as string[] | number[];

      try {
        await rpcClient.collection(options.collectionName).delete(recordIds);

        return {
          content: [{ type: 'text', text: JSON.stringify({ deletedCount: recordIds.length }) }],
        };
      } catch (error) {
        throw await toToolError(error, { logger });
      }
    },
    logger,
  );
}
