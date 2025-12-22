import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import { Logger } from '../server.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

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
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const argumentShape = createAssociateArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'associate',
    {
      title: 'Associate records in a relation',
      description:
        'Link a record to another through a one-to-many or many-to-many relation. For many-to-many relations, this creates a new entry in the join table.',
      inputSchema: argumentShape,
    },
    async (options: AssociateArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      await createActivityLog(forestServerUrl, extra, 'associate', {
        collectionName: options.collectionName,
        recordId: options.parentRecordId,
        label: `associate "${options.relationName}" with record ${options.targetRecordId}`,
      });

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
    logger,
  );
}
