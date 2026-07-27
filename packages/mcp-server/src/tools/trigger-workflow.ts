import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

      const workflows = await forestServerClient.listMcpWorkflows({
        forestServerToken,
        renderingId,
      });
      const workflow = workflows.find(candidate => candidate.workflowId === args.workflowId);

      if (!workflow) {
        throw new Error(
          `Workflow "${args.workflowId}" is not an MCP-enabled workflow you can access. ` +
            'Use listWorkflows to discover triggerable workflows.',
        );
      }

      return withActivityLog({
        forestServerClient,
        request: extra,
        action: 'triggerWorkflow',
        context: {
          collectionName: workflow.collectionName ?? undefined,
          recordId: args.recordId,
          label: `triggered the workflow "${workflow.name}"`,
        },
        logger,
        operation: async () => {
          const result = await forestServerClient.triggerWorkflow({
            forestServerToken,
            renderingId,
            workflowId: args.workflowId,
            recordId: args.recordId,
          });

          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        },
      });
    },
    logger,
  );
}
