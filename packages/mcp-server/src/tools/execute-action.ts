import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[] | null;
  values?: Record<string, unknown>;
  reasoning?: string;
}

export default function declareExecuteActionTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger, collectionNames } = ctx;
  const argumentShape = {
    ...createActionArgumentShape(collectionNames),
    reasoning: z
      .string()
      .optional()
      .describe(
        'A clear explanation of why you are executing this action. ' +
          'Shown to the approver when the action requires an approval — always provide it.',
      ),
  };

  return registerToolWithLogging(
    mcpServer,
    'executeAction',
    {
      title: 'Execute an action',
      description: `Execute a specific action on one or more records. IMPORTANT: You MUST call getActionForm first and ensure "canExecute" is true before calling this tool.

Required workflow:
1. Call getActionForm to retrieve the form fields and check if the form is valid
2. If getActionForm returns "canExecute": false, call it again with values until "canExecute": true
3. Only then call executeAction with the same values used in the last getActionForm call

If you call executeAction with missing required fields, it will return an error with the missing fields instead of executing the action.`,
      inputSchema: argumentShape,
    },
    async (options: ExecuteActionArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(
        extra,
        forestServerClient,
        ctx.agentDispatcher,
      );

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = (options.recordIds ?? []) as string[] | number[];

      return withActivityLog({
        forestServerClient,
        request: extra,
        action: 'action',
        context: {
          collectionName: options.collectionName,
          recordIds,
          label: `triggered the action "${options.actionName}"`,
        },
        logger,
        operation: async () => {
          const action = await rpcClient
            .collection(options.collectionName)
            .action(options.actionName, { recordIds });

          if (options.values) {
            await action.setFields(options.values);
          }

          const result = await action.execute({ approvalRequestMessage: options.reasoning });

          if ('approvalRequested' in result) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Approval requested: this action requires approval by another user before it runs. A request has been created and is pending review.',
                },
              ],
            };
          }

          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        },
      });
    },
    logger,
  );
}
