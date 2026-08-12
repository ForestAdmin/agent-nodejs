import type { McpWorkflowLookup } from '../http-client';
import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { NotFoundError } from '@forestadmin/forestadmin-client';
import { z } from 'zod';

import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

const WORKFLOW_ID_DESCRIPTION =
  'The id of the workflow to start, as returned by listWorkflows. The workflow must have the MCP ' +
  'trigger enabled.';

const RECORD_ID_DESCRIPTION =
  'The id of the record to run the workflow on. For collections with a composite primary key, ' +
  'use the packed id form (values joined by "|").';

interface TriggerWorkflowArgument {
  workflowId: string;
  recordId: string;
}

// One message for the unknown, MCP-disabled and trigger-time-404 cases, so the LLM-facing
// contract stays uniform and never leaks whether a given workflow exists.
function notMcpEnabledMessage(workflowId: string): string {
  return (
    `Workflow "${workflowId}" is not an MCP-enabled workflow you can access. ` +
    'Use listWorkflows to discover triggerable workflows.'
  );
}

function unavailableCollectionMessage(workflowId: string): string {
  return (
    `Workflow "${workflowId}" cannot be triggered via MCP because its collection is unavailable. ` +
    "Check the workflow's configuration in Forest."
  );
}

export default function declareTriggerWorkflowTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'triggerWorkflow',
    {
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      title: 'Trigger a workflow',
      description:
        'Start an MCP-enabled Forest workflow on a specific record. Returns a runId immediately; ' +
        'the run continues asynchronously — poll getWorkflowRun to observe its status. The record ' +
        'is not validated at trigger time: an invalid record surfaces later via getWorkflowRun. ' +
        'Discover triggerable workflows with listWorkflows first.',
      inputSchema: {
        workflowId: z.string().min(1).describe(WORKFLOW_ID_DESCRIPTION),
        recordId: z.string().min(1).describe(RECORD_ID_DESCRIPTION),
      },
    },
    async (args: TriggerWorkflowArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      // Resolve the workflow by id up front so the audit log can be labelled BEFORE the trigger
      // (fail-closed). Reject unknown or MCP-disabled workflows here — no run, no log.
      let workflow: McpWorkflowLookup;

      try {
        workflow = await forestServerClient.getMcpWorkflowById({
          forestServerToken,
          renderingId,
          workflowId: args.workflowId,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new Error(notMcpEnabledMessage(args.workflowId));
        }

        throw error;
      }

      if (!workflow.mcpEnabled) {
        throw new Error(notMcpEnabledMessage(args.workflowId));
      }

      // A renamed/deleted collection leaves collectionName null. The activity log would be dropped
      // server-side and fail-closed would block with a misleading message, so reject up front.
      if (workflow.collectionName == null) {
        throw new Error(unavailableCollectionMessage(args.workflowId));
      }

      const result = await withActivityLog({
        forestServerClient,
        request: extra,
        action: 'triggerWorkflow',
        context: {
          collectionName: workflow.collectionName,
          recordId: args.recordId,
          label: `triggered the workflow "${workflow.name}"`,
        },
        logger,
        operation: () =>
          forestServerClient.triggerMcpWorkflow({
            forestServerToken,
            renderingId,
            workflowId: args.workflowId,
            recordId: args.recordId,
          }),
        // Guard the race where the workflow is disabled/deleted between the lookup and the trigger.
        errorEnhancer: async (parsedMessage, originalError) =>
          originalError instanceof NotFoundError
            ? notMcpEnabledMessage(args.workflowId)
            : parsedMessage,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ runId: result.runId, runState: result.runState }),
          },
        ],
      };
    },
    logger,
  );
}
