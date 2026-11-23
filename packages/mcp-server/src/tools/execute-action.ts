import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ActionRequiresApprovalError, isApprovalRequested } from '@forestadmin/agent-client';
import { z } from 'zod';

import resolveUploadedFileValues from '../file-uploads/resolve';
import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import toToolError from '../utils/tool-error';
import registerToolWithLogging from '../utils/tool-with-logging';

const APPROVAL_NOT_FILED_MESSAGE =
  'This action requires approval by another user before it runs, but this server could not file ' +
  'the approval request: its Forest server URL, server token or rendering id is missing. Report ' +
  'it to your Forest administrator.';

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[] | null;
  values?: Record<string, unknown>;
  reasoning?: string;
}

export default function declareExecuteActionTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { logger, collectionNames } = ctx;
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
3. If a call revealed fields the user's request covers, fill them with another getActionForm call, even when "canExecute" is already true
4. Only then call executeAction with the same values used in the last getActionForm call

If you call executeAction with missing required fields, it will return an error with the missing fields instead of executing the action.${
        ctx.fileUploads
          ? `

To fill a file field, never inline base64 file content. Call requestActionFileUpload to get an upload destination, upload the raw bytes there, and pass the returned fileHandle string as the field value.`
          : ''
      }`,
      inputSchema: argumentShape,
    },
    async (options: ExecuteActionArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(extra, ctx);

      // Cast to satisfy the type system - the API accepts both string[] and number[]
      const recordIds = (options.recordIds ?? []) as string[] | number[];

      try {
        const result = await rpcClient
          .collection(options.collectionName)
          .executeAction(options.actionName, {
            recordIds,
            approvalRequestMessage: options.reasoning,
            fill: async action => {
              if (!options.values) return;

              await action.setFields(
                await resolveUploadedFileValues(options.values, extra.authInfo, ctx.fileUploads),
              );
            },
          });

        if (isApprovalRequested(result)) {
          const requestId = result.approvalRequest?.id;

          return {
            content: [
              {
                type: 'text',
                text: `Approval requested: this action requires approval by another user before it runs. A request has been created and is pending review.${
                  requestId ? ` Approval request id: ${requestId}.` : ''
                }`,
              },
            ],
          };
        }

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        if (error instanceof ActionRequiresApprovalError) {
          throw new Error(APPROVAL_NOT_FILED_MESSAGE);
        }

        throw await toToolError(error, { logger });
      }
    },
    logger,
  );
}
