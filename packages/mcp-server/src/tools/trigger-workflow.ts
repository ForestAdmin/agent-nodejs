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

// The server answers 404 both for an unknown workflow and for one whose MCP trigger is disabled
// (and getMcpWorkflowById returns mcpEnabled: false for the latter). Surface the same guidance in
// every case so the LLM-facing contract stays identical.
function notMcpEnabledMessage(workflowId: string): string {
  return (
    `Workflow "${workflowId}" is not an MCP-enabled workflow you can access. ` +
    'Use listWorkflows to discover triggerable workflows.'
  );
}

export default function declareTriggerWorkflowTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'triggerWorkflow',
    {
      title: 'Trigger a workflow',
      description:
        'Start an MCP-enabled Forest workflow on a specific record. Returns a runId immediately; ' +
        'the run continues asynchronously — poll getWorkflowRun to observe its status. The record ' +
        'is not validated at trigger time: an invalid record surfaces later via getWorkflowRun. ' +
        'Discover triggerable workflows with listWorkflows first.',
      inputSchema: {
        workflowId: z.string().describe(WORKFLOW_ID_DESCRIPTION),
        recordId: z.string().describe(RECORD_ID_DESCRIPTION),
      },
    },
    async (args: TriggerWorkflowArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      // Resolve the workflow O(1) up front so the audit log can be labelled with its name/collection
      // BEFORE the trigger (fail-closed, like create/update/delete). Reject unknown or MCP-disabled
      // workflows here — no run is started and no log is written for a non-triggerable workflow.
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

      const result = await withActivityLog({
        forestServerClient,
        request: extra,
        action: 'triggerWorkflow',
        context: {
          collectionName: workflow.collectionName ?? undefined,
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
