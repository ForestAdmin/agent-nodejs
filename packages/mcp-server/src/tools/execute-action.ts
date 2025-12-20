import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient, { ActionEndpointsMap } from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

// Preprocess to handle LLM sending recordIds as JSON string instead of array
const recordIdsWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.array(z.union([z.string(), z.number()])).optional());

// Preprocess to handle LLM sending values as JSON string instead of object
const valuesWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.record(z.string(), z.unknown()).optional());

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds?: (string | number)[];
  values?: Record<string, unknown>;
}

// Full action result as returned by the agent (agent-client types are too restrictive)
interface ActionResultFromAgent {
  // Success result
  success?: string;
  html?: string;
  refresh?: { relationships: string[] };
  // Error result (returned with HTTP 400, but caught and re-thrown)
  error?: string;
  // Webhook result
  webhook?: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body: unknown;
  };
  // Redirect result
  redirectTo?: string;
  // Note: File results are streams and cannot be handled via JSON-based MCP protocol
}

function formatActionResult(result: ActionResultFromAgent): {
  type: 'Success' | 'Webhook' | 'Redirect';
  message?: string;
  html?: string;
  invalidatedRelations?: string[];
  webhook?: { url: string; method: string; headers: Record<string, string>; body: unknown };
  redirectTo?: string;
} {
  // Webhook result
  if (result.webhook) {
    return {
      type: 'Webhook',
      webhook: result.webhook,
    };
  }

  // Redirect result
  if (result.redirectTo) {
    return {
      type: 'Redirect',
      redirectTo: result.redirectTo,
    };
  }

  // Success result (default)
  return {
    type: 'Success',
    message: result.success || 'Action executed successfully',
    html: result.html || null,
    invalidatedRelations: result.refresh?.relationships || [],
  };
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0
        ? z.enum(collectionNames as [string, ...string[]]).describe('The name of the collection')
        : z.string().describe('The name of the collection'),
    actionName: z.string().describe('The name of the action to execute'),
    recordIds: recordIdsWithPreprocess.describe(
      'The IDs of the records to apply the action to. Required for single/bulk actions, optional for global actions.',
    ),
    values: valuesWithPreprocess.describe(
      'The form field values to set before executing the action. Keys are field names, values are the field values.',
    ),
  };
}

export default function declareExecuteActionTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
  actionEndpoints: ActionEndpointsMap = {},
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'executeAction',
    {
      title: 'Execute an action',
      description:
        'Execute an action on a collection with optional form values. For actions with forms, use getActionForm first to see required fields. Returns result with type: Success (message, html, invalidatedRelations), Webhook (url, method, headers, body), or Redirect (redirectTo). File downloads are not supported via MCP.',
      inputSchema: argumentShape,
    },
    async (options: ExecuteActionArgument, extra) => {
      const { rpcClient } = await buildClient(extra, actionEndpoints);

      await createActivityLog(forestServerUrl, extra, 'executeAction', {
        collectionName: options.collectionName,
        label: options.actionName,
      });

      try {
        const recordIds = options.recordIds as string[] | number[] | undefined;
        const action = await rpcClient
          .collection(options.collectionName)
          .action(options.actionName, { recordIds });

        // Set form values if provided
        if (options.values && Object.keys(options.values).length > 0) {
          await action.setFields(options.values);
        }

        // Execute the action - cast to ActionResultFromAgent since agent-client types are too restrictive
        const result = (await action.execute()) as unknown as ActionResultFromAgent;
        const formattedResult = formatActionResult(result);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedResult, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorDetail = parseAgentError(error);
        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
