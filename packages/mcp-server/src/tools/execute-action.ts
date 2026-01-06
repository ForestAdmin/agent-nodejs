import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import { buildClientWithActions } from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

// Preprocess to handle LLM sending values as JSON string instead of object
const valuesWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.record(z.string(), z.unknown()));

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values?: Record<string, unknown>;
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    actionName: z.string().describe('The name of the action to execute.'),
    recordIds: z
      .array(z.union([z.string(), z.number()]))
      .describe('The IDs of the records to execute the action on.'),
    values: valuesWithPreprocess.optional().describe('Optional values for the action form fields.'),
  };
}

export default function declareExecuteActionTool(
  mcpServer: McpServer,
  forestServerClient: ForestServerClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'executeAction',
    {
      title: 'Execute an action',
      description: `Execute a specific action on one or more records. IMPORTANT: You MUST call getActionForm first and ensure "isValid" is true before calling this tool.

Required workflow:
1. Call getActionForm to retrieve the form fields and check if the form is valid
2. If getActionForm returns "isValid": false, call it again with values until "isValid": true
3. Only then call executeAction with the same values used in the last getActionForm call

If you call executeAction with missing required fields, it will return an error with the missing fields instead of executing the action.`,
      inputSchema: argumentShape,
    },
    async (options: ExecuteActionArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(extra, forestServerClient);

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = options.recordIds as string[] | number[];

      return withActivityLog({
        forestServerClient,
        request: extra,
        action: 'action',
        context: {
          collectionName: options.collectionName,
          recordIds,
          label: `Trigger the action "${options.actionName}" on records ${recordIds.join(
            ',',
          )} from the collection ${options.collectionName}`,
        },
        logger,
        operation: async () => {
          const action = await rpcClient
            .collection(options.collectionName)
            .action(options.actionName, { recordIds });

          if (options.values) {
            await action.setFields(options.values);
          }

          const result = await action.execute();

          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        },
      });
    },
    logger,
  );
}
