import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';

const COLLECTION_NAME_DESCRIPTION =
  'Optional. Narrow the results to workflows operating on this collection — typically the ' +
  'collection of the record currently in context.';

export function createListWorkflowsArgumentShape(collectionNames: string[]) {
  const collectionName =
    collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string();

  return {
    collectionName: collectionName.optional().describe(COLLECTION_NAME_DESCRIPTION),
  };
}

export type ListWorkflowsArgument = z.infer<
  z.ZodObject<ReturnType<typeof createListWorkflowsArgumentShape>>
>;

export default function declareListWorkflowsTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger, collectionNames } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'listWorkflows',
    {
      annotations: { readOnlyHint: true },
      title: 'List MCP-enabled workflows',
      description:
        'Discover Forest workflows enabled for MCP triggering that you can access. Returns each ' +
        "workflow's id, name and the collection it operates on. Optionally filter by collectionName " +
        'to match the record currently in context, then start one with triggerWorkflow.',
      inputSchema: createListWorkflowsArgumentShape(collectionNames),
    },
    async (args: ListWorkflowsArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      const workflows = await forestServerClient.listMcpEnabledWorkflows({
        forestServerToken,
        renderingId,
        collectionName: args.collectionName,
      });

      // A workflow whose collection was renamed or removed cannot be triggered - triggerWorkflow
      // rejects a null collectionName up front - so listing it would only send the model round the
      // discover, trigger, rejected, discover loop. Surface the drop to the operator instead.
      const triggerable = workflows.filter(workflow => workflow.collectionName !== null);
      const droppedCount = workflows.length - triggerable.length;

      if (droppedCount > 0) {
        logger(
          'Warn',
          `listWorkflows hid ${droppedCount} MCP-enabled workflow(s) whose collection is no longer ` +
            'available in this rendering; they cannot be triggered until their configuration is fixed.',
        );
      }

      return { content: [{ type: 'text', text: JSON.stringify(triggerable) }] };
    },
    logger,
  );
}
