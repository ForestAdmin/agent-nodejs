import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';

const RUN_ID_DESCRIPTION = 'The id of the workflow run to observe, as returned by triggerWorkflow.';

interface GetWorkflowRunArgument {
  runId: string;
}

export default function declareGetWorkflowRunTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'getWorkflowRun',
    {
      annotations: { readOnlyHint: true },
      title: 'Get a workflow run status',
      description:
        'Poll a workflow run started with triggerWorkflow. Returns the full hydrated run: its ' +
        'runState (started, pending, loading, aborted or finished) plus the complete ' +
        'workflowHistory — every step with its resolved definition (type, title, prompt, task ' +
        'type, outgoing branches) and its per-step context (completion, selected option, error, ' +
        'escalation state, awaiting-input reason). Use it to see exactly where the run is and ' +
        'what each step does. A run parked on a human-gated step cannot be resumed via MCP in ' +
        'v1 and must be finished from the Forest UI.',
      inputSchema: {
        runId: z.string().describe(RUN_ID_DESCRIPTION),
      },
    },
    async (args: GetWorkflowRunArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      const runStatus = await forestServerClient.getMcpWorkflowRun({
        forestServerToken,
        renderingId,
        runId: args.runId,
      });

      return { content: [{ type: 'text', text: JSON.stringify(runStatus) }] };
    },
    logger,
  );
}
