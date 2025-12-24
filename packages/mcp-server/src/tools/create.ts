import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

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
): string {
  const argumentShape = createArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'create',
    {
      title: 'Create a record',
      description: 'Create a new record in the specified collection.',
      inputSchema: argumentShape,
    },
    async (options: CreateArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      return withActivityLog({
        forestServerUrl,
        request: extra,
        action: 'create',
        context: { collectionName: options.collectionName },
        logger,
        operation: async () => {
          const record = await rpcClient
            .collection(options.collectionName)
            .create(options.attributes);

          return { content: [{ type: 'text', text: JSON.stringify({ record }) }] };
        },
      });
    },
    logger,
  );
}
