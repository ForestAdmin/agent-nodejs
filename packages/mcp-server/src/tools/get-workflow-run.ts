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
        'Poll the status of a workflow run started with triggerWorkflow. Returns runState, the ' +
        'currentStep, waitingForHumanInput, and — once finished — the terminal result or error. ' +
        'A run parked on a human-gated step reports waitingForHumanInput: true; it cannot be ' +
        'resumed via MCP and must be finished from the Forest UI.',
      inputSchema: {
        runId: z.string().describe(RUN_ID_DESCRIPTION),
      },
    },
    async (args: GetWorkflowRunArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      const runStatus = await forestServerClient.getWorkflowRun({
        forestServerToken,
        renderingId,
        runId: args.runId,
      });

      return { content: [{ type: 'text', text: JSON.stringify(runStatus) }] };
    },
    logger,
  );
}
