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

interface CreateArgument {
  collectionName: string;
  attributes: Record<string, unknown>;
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    attributes: attributesWithPreprocess.describe(
      'The attributes of the record to create. Must be an object with field names as keys.',
    ),
  };
}

export default function declareCreateTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'create',
    {
      title: 'Create a record',
      description: 'Create a new record in the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: CreateArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      await createActivityLog(forestServerUrl, extra, 'create', {
        collectionName: options.collectionName,
      });

      try {
        const record = await rpcClient
          .collection(options.collectionName)
          .create(options.attributes);

        return { content: [{ type: 'text', text: JSON.stringify({ record }) }] };
      } catch (error) {
        const errorDetail = parseAgentError(error);
        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
