import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import toToolError from '../utils/tool-error';
import registerToolWithLogging from '../utils/tool-with-logging';

// Preprocess to handle LLM sending attributes as JSON string instead of object
const attributesWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.record(z.string(), z.unknown()));

interface UpdateArgument {
  collectionName: string;
  recordId: string | number;
  attributes: Record<string, unknown>;
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    recordId: z.union([z.string(), z.number()]).describe('The ID of the record to update.'),
    attributes: attributesWithPreprocess.describe(
      'The attributes to update. Must be an object with field names as keys.',
    ),
  };
}

export default function declareUpdateTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { logger, collectionNames } = ctx;
  const argumentShape = createArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'update',
    {
      title: 'Update a record',
      description: 'Update an existing record in the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: UpdateArgument, extra) => {
      const { rpcClient } = buildClient(extra, ctx);

      try {
        const record = await rpcClient
          .collection(options.collectionName)
          .update(options.recordId, options.attributes);

        return { content: [{ type: 'text', text: JSON.stringify({ record }) }] };
      } catch (error) {
        throw await toToolError(error, { logger });
      }
    },
    logger,
  );
}
