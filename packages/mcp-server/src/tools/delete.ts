import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

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
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'delete',
    {
      title: 'Delete records',
      description: 'Delete one or more records from the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: DeleteArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = options.recordIds as string[] | number[];

      await createActivityLog(forestServerUrl, extra, 'delete', {
        collectionName: options.collectionName,
        recordIds,
      });

      try {
        await rpcClient.collection(options.collectionName).delete(recordIds);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully deleted ${options.recordIds.length} record(s) from ${options.collectionName}`,
              }),
            },
          ],
        };
      } catch (error) {
        const errorDetail = parseAgentError(error);
        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
