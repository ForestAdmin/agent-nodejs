import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values?: Record<string, unknown>;
}

export default function declareExecuteActionTool(
  mcpServer: McpServer,
  forestServerClient: ForestServerClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createActionArgumentShape(collectionNames);

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
