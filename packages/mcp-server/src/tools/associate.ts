import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

interface AssociateArgument {
  collectionName: string;
  relationName: string;
  parentRecordId: string | number;
  targetRecordId: string | number;
}

function createAssociateArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    relationName: z.string().describe('Name of the relation (one-to-many or many-to-many)'),
    parentRecordId: z
      .union([z.string(), z.number()])
      .describe('ID of the parent record that owns the relation'),
    targetRecordId: z
      .union([z.string(), z.number()])
      .describe('ID of the record to associate with the parent'),
  };
}

export default function declareAssociateTool(
  mcpServer: McpServer,
  forestServerClient: ForestServerClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createAssociateArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'associate',
    {
      title: 'Associate records in a relation',
      description:
        'Link a record to another through a one-to-many or many-to-many relation. For many-to-many relations, this creates a new entry in the join table.',
      inputSchema: argumentShape,
    },
    async (options: AssociateArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      return withActivityLog({
        forestServerClient,
        request: extra,
        action: 'update',
        context: {
          collectionName: options.collectionName,
          recordId: options.parentRecordId,
          label: `associate "${options.relationName}" with record ${options.targetRecordId}`,
        },
        logger,
        operation: async () => {
          const relation = rpcClient
            .collection(options.collectionName)
            .relation(options.relationName, options.parentRecordId);

          await relation.associate(options.targetRecordId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Successfully associated record ${options.targetRecordId} with ${options.collectionName}/${options.parentRecordId} through relation "${options.relationName}"`,
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
