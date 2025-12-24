import type { Logger } from '../server';
import type { SelectOptions } from '@forestadmin/agent-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import filterSchema from '../schemas/filter';
import buildClient from '../utils/agent-caller';
import { fetchForestSchema, getFieldsOfCollection } from '../utils/schema-fetcher';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

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
  enableCount: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, also returns totalCount of matching records'),
});

export type ListArgument = z.infer<typeof listArgumentSchema>;

export function createListArgumentShape(collectionNames: string[]) {
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
): string {
  const listArgumentShape = createListArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'list',
    {
      title: 'List records from a collection',
      description: 'Retrieve a list of records from the specified collection.',
      inputSchema: listArgumentShape,
    },
    async (options: ListArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      let actionType: 'index' | 'search' | 'filter' = 'index';

      if (options.search) {
        actionType = 'search';
      } else if (options.filters) {
        actionType = 'filter';
      }

      return withActivityLog({
        forestServerUrl,
        request: extra,
        action: actionType,
        context: { collectionName: options.collectionName },
        logger,
        operation: async () => {
          const collection = rpcClient.collection(options.collectionName);

          let response: { records: unknown[]; totalCount?: number };

          if (options.enableCount) {
            const [records, totalCount] = await Promise.all([
              collection.list(options as SelectOptions),
              collection.count(options as SelectOptions),
            ]);

            response = { records, totalCount };
          } else {
            const records = await collection.list(options as SelectOptions);
            response = { records };
          }

          return { content: [{ type: 'text', text: JSON.stringify(response) }] };
        },
        errorEnhancer: async errorMessage => {
          // Enhance "Invalid sort" errors with available sortable fields
          if (errorMessage?.includes('Invalid sort')) {
            try {
              const fields = getFieldsOfCollection(
                await fetchForestSchema(forestServerUrl),
                options.collectionName,
              );

              return `The sort field provided is invalid for this collection. Available fields for the collection ${
                options.collectionName
              } are: ${fields
                .filter(field => field.isSortable)
                .map(field => field.field)
                .join(', ')}.`;
            } catch (schemaError) {
              logger('Debug', `Failed to fetch schema for error enhancement: ${schemaError}`);
            }
          }

          return errorMessage;
        },
      });
    },
    logger,
  );
}
