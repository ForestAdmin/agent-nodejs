import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import getAuthContext from '../utils/auth-context';
import registerToolWithLogging from '../utils/tool-with-logging';
import toModelSafeError from '../utils/workflow-error';

const LISTING_UNAVAILABLE_MESSAGE =
  'The MCP-enabled workflows could not be listed because Forest could not be reached. This is a ' +
  'temporary server-side failure — retry later, and report it to your Forest administrator if it ' +
  'persists.';

const COLLECTION_NAME_DESCRIPTION =
  'Optional. Narrow the results to workflows operating on this collection — typically the ' +
  'collection of the record currently in context.';

function createListWorkflowsArgumentShape(collectionNames: string[]) {
  const collectionName =
    collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string();

  return {
    collectionName: collectionName.optional().describe(COLLECTION_NAME_DESCRIPTION),
  };
}

type ListWorkflowsArgument = z.infer<
  z.ZodObject<ReturnType<typeof createListWorkflowsArgumentShape>>
>;

export default function declareListWorkflowsTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger, collectionNames } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'listWorkflows',
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
      title: 'List MCP-enabled workflows',
      description:
        'Discover Forest workflows enabled for MCP triggering that you can access. Returns each ' +
        "workflow's id, name and the collection it operates on. Optionally filter by collectionName " +
        'to match the record currently in context, then start one with triggerWorkflow.',
      inputSchema: createListWorkflowsArgumentShape(collectionNames),
    },
    async (args: ListWorkflowsArgument, extra) => {
      const { forestServerToken, renderingId } = getAuthContext(extra);

      let workflows;

      try {
        workflows = await forestServerClient.listMcpEnabledWorkflows({
          forestServerToken,
          renderingId,
          collectionName: args.collectionName,
        });
      } catch (error) {
        // Forest's own refusals still reach the model — they say something actionable. What must
        // not is a raw transport failure: its message carries the Forest server URL and an internal
        // host and port, and this result is stringified straight into a model's context.
        throw toModelSafeError(error, {
          logger,
          context: 'Failed to list MCP-enabled workflows',
          unavailableMessage: LISTING_UNAVAILABLE_MESSAGE,
        });
      }

      // A workflow whose collection was renamed or removed cannot be triggered - triggerWorkflow
      // rejects a null collectionName up front - so listing it would only send the model round the
      // discover, trigger, rejected, discover loop. Surface the drop to the operator instead.
      // `!= null` on purpose, to match triggerWorkflow's own guard: an absent key and an explicit
      // null must be dropped by the same rule, or the discover/trigger loop reopens.
      const triggerable = workflows.filter(workflow => workflow.collectionName != null);
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
