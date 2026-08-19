import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';
import toModelSafeError from '../utils/workflow-error';

const RUN_ID_DESCRIPTION = 'The id of the workflow run to observe, as returned by triggerWorkflow.';

function runUnavailableMessage(runId: string): string {
  return (
    `Run "${runId}" could not be read because Forest could not be reached. This is a temporary ` +
    'server-side failure, not a problem with the run id — retry later, and report it to your ' +
    'Forest administrator if it persists.'
  );
}

interface GetWorkflowRunArgument {
  runId: string;
}

export default function declareGetWorkflowRunTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'getWorkflowRun',
    {
      // Spelled out rather than relying on defaults: the MCP spec defaults an omitted
      // destructiveHint to true, so a client reading that field alone would treat these
      // reads as destructive.
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      title: 'Get a workflow run status',
      description:
        'Poll a workflow run started with triggerWorkflow. Returns the full hydrated run: its ' +
        'runState (started, pending, loading, aborted or finished) plus the complete ' +
        'workflowHistory — every step with its resolved definition (type, title, prompt, task ' +
        'type, outgoing branches) and its per-step context (completion, selected option, error, ' +
        'escalation state, awaiting-input reason). Use it to see exactly where the run is and ' +
        'what each step does. A run parked on a human-gated step cannot be resumed via MCP in ' +
        'v1 and must be finished from the Forest UI. Poll at a reasonable interval: wait at ' +
        'least a few seconds between calls, and do not busy-loop on a long-running or ' +
        'human-gated run (which never resolves via MCP in v1).',
      inputSchema: {
        runId: z.string().min(1).describe(RUN_ID_DESCRIPTION),
      },
    },
    async (args: GetWorkflowRunArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      let runStatus;

      try {
        runStatus = await forestServerClient.getMcpWorkflowRun({
          forestServerToken,
          renderingId,
          runId: args.runId,
        });
      } catch (error) {
        // Same rule as the two sibling workflow tools: Forest's own refusal is worth reading, a
        // raw transport failure is transport detail the model must never receive.
        throw toModelSafeError(error, {
          logger,
          context: `Failed to read workflow run "${args.runId}"`,
          unavailableMessage: runUnavailableMessage(args.runId),
        });
      }

      return { content: [{ type: 'text', text: JSON.stringify(runStatus) }] };
    },
    logger,
  );
}
