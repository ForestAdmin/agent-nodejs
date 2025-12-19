import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

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

export default function declareUpdateTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'update',
    {
      title: 'Update a record',
      description: 'Update an existing record in the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: UpdateArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      await createActivityLog(forestServerUrl, extra, 'update', {
        collectionName: options.collectionName,
        recordId: options.recordId,
      });

      try {
        const record = await rpcClient
          .collection(options.collectionName)
          .update(options.recordId, options.attributes);

        return { content: [{ type: 'text', text: JSON.stringify({ record }) }] };
      } catch (error) {
        const errorDetail = parseAgentError(error);
        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
