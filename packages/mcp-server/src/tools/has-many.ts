import type { SelectOptions } from '@forestadmin/agent-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import type { ListArgument } from './list.js';
import { createListArgumentShape } from './list.js';
import { Logger } from '../server.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import { fetchForestSchema, getFieldsOfCollection } from '../utils/schema-fetcher.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

function createHasManyArgumentShape(collectionNames: string[]) {
  return {
    ...createListArgumentShape(collectionNames),
    relationName: z.string(),
    parentRecordId: z.union([z.string(), z.number()]),
  };
}

type HasManyArgument = ListArgument & {
  relationName: string;
  parentRecordId: string | number;
};

export default function declareListHasManyTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const listArgumentShape = createHasManyArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'getHasMany',
    {
      title: 'List records from a hasMany relationship',
      description: 'Retrieve a list of records from the specified hasMany relationship.',
      inputSchema: listArgumentShape,
    },
    async (options: HasManyArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      await createActivityLog(forestServerUrl, extra, 'index', {
        collectionName: options.collectionName,
        recordId: options.parentRecordId,
        label: `list hasMany relation "${options.relationName}"`,
      });

      try {
        const result = await rpcClient
          .collection(options.collectionName)
          .relation(options.relationName, options.parentRecordId)
          .list(options as SelectOptions);

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        // Parse error text if it's a JSON string from the agent
        const errorDetail = parseAgentError(error);

        const fields = getFieldsOfCollection(
          await fetchForestSchema(forestServerUrl),
          options.collectionName,
        );

        if (
          error.message?.toLowerCase()?.includes('not found') &&
          !fields
            .filter(field => field.relationship === 'HasMany')
            .some(field => field.field === options.relationName)
        ) {
          throw new Error(
            `The relation name provided is invalid for this collection. Available relation for the collection are ${
              options.collectionName
            } are: ${fields
              .filter(field => field.relationship === 'HasMany')
              .map(field => field.field)
              .join(', ')}.`,
          );
        }

        if (errorDetail?.includes('Invalid sort')) {
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
