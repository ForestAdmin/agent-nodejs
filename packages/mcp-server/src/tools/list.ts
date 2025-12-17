import type { Logger } from '../server';
import type { SelectOptions } from '@forestadmin/agent-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import filterSchema from '../schemas/filter.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import { fetchForestSchema, getFieldsOfCollection } from '../utils/schema-fetcher.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

// Preprocess to handle LLM sending filters as JSON string instead of object
const filtersWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    // Return original value to let Zod validation produce a proper error
    return val;
  }
}, filterSchema);

const listArgumentSchema = z.object({
  collectionName: z.string(),
  search: z.string().optional(),
  filters: filtersWithPreprocess
    .describe(
      'Filters to apply on collection. To filter on a nested field, use "@@@" to separate relations, e.g. "relationName@@@fieldName". One level deep max.',
    )
    .optional(),
  sort: z
    .object({
      field: z.string(),
      ascending: z.boolean(),
    })
    .optional(),
  shouldSearchInRelation: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to search also on related collections'),
  fields: z
    .array(z.string())
    .describe(
      'Fields to include in the list. Reduces the amount of data returned. For sub fields, use "@@@" to separate relations, e.g. "relationName@@@fieldName".',
    )
    .optional(),
  pagination: z
    .object({
      size: z.number().default(15).optional(),
      number: z.number().default(1).optional(),
    })
    .optional(),
});

type ListArgument = z.infer<typeof listArgumentSchema>;

function createListArgumentShape(collectionNames: string[]) {
  return {
    ...listArgumentSchema.shape,
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
  };
}

export default function declareListTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const listArgumentShape = createListArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'list',
    {
      title: 'List records from a collection',
      description: 'Retrieve a list of records from the specified collection.',
      inputSchema: listArgumentShape,
    },
    async (options: ListArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      let actionType = 'index';

      if (options.search) {
        actionType = 'search';
      } else if (options.filters) {
        actionType = 'filter';
      }

      await createActivityLog(forestServerUrl, extra, actionType, {
        collectionName: options.collectionName,
      });

      try {
        const result = await rpcClient
          .collection(options.collectionName)
          .list(options as SelectOptions);

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        // Parse error text if it's a JSON string from the agent
        const errorDetail = parseAgentError(error);

        if (errorDetail?.includes('Invalid sort')) {
          const fields = getFieldsOfCollection(
            await fetchForestSchema(forestServerUrl),
            options.collectionName,
          );
          throw new Error(
            `The sort field provided is invalid for this collection. Available fields for the collection ${
              options.collectionName
            } are: ${fields
              .filter(field => field.isSortable)
              .map(field => field.field)
              .join(', ')}.`,
          );
        }

        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
