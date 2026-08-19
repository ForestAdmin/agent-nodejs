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
// contract stays uniform and never leaks whether a given workflow exists. The last sentence exists
// so a model cannot loop: an orchestrator that predates (or was rolled back before) the by-id
// endpoint 404s every lookup while listWorkflows keeps returning the same ids.
function notMcpEnabledMessage(workflowId: string): string {
  return (
    `Workflow "${workflowId}" is not an MCP-enabled workflow you can access. ` +
    'Use listWorkflows to discover triggerable workflows. If listWorkflows just returned this id, ' +
    'do not retry — report it to your Forest administrator instead.'
  );
}

// Distinct from the uniform 404 message: the workflow may well exist and be triggerable, Forest
// just could not be reached. Retrying later is the right advice, and the transport detail stays in
// the operator log rather than in the model's context.
function lookupUnavailableMessage(workflowId: string): string {
  return (
    `Workflow "${workflowId}" could not be resolved because Forest could not be reached. ` +
    'This is a temporary server-side failure, not a problem with the workflow id — retry later, ' +
    'and report it to your Forest administrator if it persists.'
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
        // 255 matches the server's selectedRecordId column, so an over-long id is rejected here
        // rather than after the pending audit row has been written.
        recordId: z.string().min(1).max(255).describe(RECORD_ID_DESCRIPTION),
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
        // Always log: a 404 here is indistinguishable from a missing route, so without this an
        // orchestrator too old to serve the lookup is visible only to the model.
        logger(
          'Error',
          `Failed to resolve workflow "${args.workflowId}" via getMcpWorkflowById: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        if (error instanceof NotFoundError) {
          throw new Error(notMcpEnabledMessage(args.workflowId));
        }

        // Anything else (5xx, timeout, ECONNREFUSED) carries transport detail — the Forest server
        // URL, an internal host and port — that has no business in a model's context. The full
        // error is in the operator log above.
        throw new Error(lookupUnavailableMessage(args.workflowId));
      }

      if (!workflow.mcpEnabled) {
        throw new Error(notMcpEnabledMessage(args.workflowId));
      }

      // A renamed/deleted collection leaves collectionName null, which the audit route rejects
      // (collectionModelName is required). Fail-closed would then block with a misleading message,
      // so reject up front with one that names the actual problem.
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
          // Matches the orchestrator's own "via MCP" row — one trigger writes two entries.
          label: `triggered the workflow "${workflow.name}" via MCP`,
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
