import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

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

export default function declareDeleteTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): string {
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
      const { rpcClient } = buildClient(extra);

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = options.recordIds as string[] | number[];

      return withActivityLog({
        forestServerUrl,
        request: extra,
        action: 'delete',
        context: {
          collectionName: options.collectionName,
          recordIds,
        },
        logger,
        operation: async () => {
          await rpcClient.collection(options.collectionName).delete(recordIds);

          return {
            content: [{ type: 'text', text: JSON.stringify({ deletedCount: recordIds.length }) }],
          };
        },
      });
    },
    logger,
  );
}
