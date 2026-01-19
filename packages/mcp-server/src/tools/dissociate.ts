import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

interface DissociateArgument {
  collectionName: string;
  relationName: string;
  parentRecordId: string | number;
  targetRecordIds: (string | number)[];
}

function createDissociateArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    relationName: z.string().describe('Name of the relation (one-to-many or many-to-many)'),
    parentRecordId: z
      .union([z.string(), z.number()])
      .describe('ID of the parent record that owns the relation'),
    targetRecordIds: z
      .array(z.union([z.string(), z.number()]))
      .describe('IDs of the records to dissociate from the parent'),
  };
}

export default function declareDissociateTool(
  mcpServer: McpServer,
  forestServerClient: ForestServerClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createDissociateArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'dissociate',
    {
      title: 'Dissociate records from a relation',
      description:
        'Unlink records from a one-to-many or many-to-many relation. For many-to-many relations, this removes entries from the join table without deleting the target records.',
      inputSchema: argumentShape,
    },
    async (options: DissociateArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      return withActivityLog({
        forestServerClient,
        request: extra,
        action: 'dissociate',
        context: {
          collectionName: options.collectionName,
          recordId: options.parentRecordId,
          label: `dissociate "${options.relationName}" from ${options.targetRecordIds.length} record(s)`,
        },
        logger,
        operation: async () => {
          const relation = rpcClient
            .collection(options.collectionName)
            .relation(options.relationName, options.parentRecordId);

          await relation.dissociate(options.targetRecordIds);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Successfully dissociated ${options.targetRecordIds.length} record(s) from ${options.collectionName}/${options.parentRecordId} through relation "${options.relationName}"`,
                }),
              },
            ],
          };
        },
      });
    },
    logger,
  );
}
