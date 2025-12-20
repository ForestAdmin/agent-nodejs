import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient, { ActionEndpointsMap } from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

// Preprocess to handle LLM sending recordIds as JSON string instead of array
const recordIdsWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.array(z.union([z.string(), z.number()])).optional());

interface GetActionFormArgument {
  collectionName: string;
  actionName: string;
  recordIds?: (string | number)[];
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0
        ? z.enum(collectionNames as [string, ...string[]]).describe('The name of the collection')
        : z.string().describe('The name of the collection'),
    actionName: z.string().describe('The name of the action to get the form for'),
    recordIds: recordIdsWithPreprocess.describe(
      'The IDs of the records to apply the action to. Required for single/bulk actions, optional for global actions.',
    ),
  };
}

interface ActionFieldInfo {
  getName: () => string;
  getType: () => string;
  getValue: () => unknown;
  isRequired: () => boolean;
}

function formatFieldForResponse(field: ActionFieldInfo) {
  return {
    name: field.getName(),
    type: field.getType(),
    value: field.getValue(),
    isRequired: field.isRequired(),
  };
}

export default function declareGetActionFormTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
  actionEndpoints: ActionEndpointsMap = {},
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'getActionForm',
    {
      title: 'Get action form',
      description:
        'Load the form fields for an action. Use this to see what fields are required before executing an action. For dynamic forms, field values may affect other fields.',
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClient(extra, actionEndpoints);

      await createActivityLog(forestServerUrl, extra, 'getActionForm', {
        collectionName: options.collectionName,
        label: options.actionName,
      });

      try {
        const recordIds = options.recordIds as string[] | number[] | undefined;
        const action = await rpcClient
          .collection(options.collectionName)
          .action(options.actionName, { recordIds });

        const fields = action.getFields();
        const formattedFields = fields.map(formatFieldForResponse);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  collectionName: options.collectionName,
                  actionName: options.actionName,
                  fields: formattedFields,
                },
                null,
                2,
              ),
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
