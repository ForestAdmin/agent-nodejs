import type { WorkflowRunTriggerResult } from '../http-client';
import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { NotFoundError } from '@forestadmin/forestadmin-client';
import { z } from 'zod';

import createPendingActivityLog, {
  markActivityLogAsSucceeded,
} from '../utils/activity-logs-creator';
import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';

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

      let result: WorkflowRunTriggerResult;

      try {
        result = await forestServerClient.triggerMcpWorkflow({
          forestServerToken,
          renderingId,
          workflowId: args.workflowId,
          recordId: args.recordId,
        });
      } catch (error) {
        // The server answers 404 both for an unknown workflow and for one whose MCP trigger is
        // disabled (indistinguishable on purpose). Surface the same guidance the tool gave when
        // it validated the id client-side, so the LLM-facing contract stays identical.
        if (error instanceof NotFoundError) {
          throw new Error(
            `Workflow "${args.workflowId}" is not an MCP-enabled workflow you can access. ` +
              'Use listWorkflows to discover triggerable workflows.',
          );
        }

        throw error;
      }

      // Audit the successful trigger. The start endpoint echoes the workflow name/collection so we
      // can label the log without a prior listing; fall back to the id when an older server omits
      // them. The run is already started, so a logging hiccup must not fail the tool.
      try {
        const activityLog = await createPendingActivityLog(
          forestServerClient,
          extra,
          'triggerWorkflow',
          {
            collectionName: result.collectionName ?? undefined,
            recordId: args.recordId,
            label: `triggered the workflow "${result.workflowName ?? args.workflowId}"`,
          },
        );

        markActivityLogAsSucceeded({ forestServerClient, request: extra, activityLog, logger });
      } catch (error) {
        logger(
          'Warn',
          `Failed to record triggerWorkflow activity log: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

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
