import type { ListArgument } from './list';
import type { Logger } from '../server';
import type { SelectOptions } from '@forestadmin/agent-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { z } from 'zod';

import { createListArgumentShape } from './list';
import buildClient from '../utils/agent-caller';
import { fetchForestSchema, getFieldsOfCollection } from '../utils/schema-fetcher';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

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

/**
 * Creates an error enhancer for list-related operations.
 * Enhances error messages with helpful context about available relations and sortable fields.
 */
function createErrorEnhancer(
  forestServerUrl: string,
  options: HasManyArgument,
  logger: Logger,
): (errorMessage: string) => Promise<string> {
  return async (errorMessage: string) => {
    try {
      const fields = getFieldsOfCollection(
        await fetchForestSchema(forestServerUrl),
        options.collectionName,
      );

      const toManyRelations = fields.filter(
        field => field.relationship === 'HasMany' || field.relationship === 'BelongsToMany',
      );

      if (
        errorMessage?.toLowerCase()?.includes('not found') &&
        !toManyRelations.some(field => field.field === options.relationName)
      ) {
        return `The relation name provided is invalid for this collection. Available relations for collection ${
          options.collectionName
        } are: ${toManyRelations.map(field => field.field).join(', ')}.`;
      }

      if (errorMessage?.includes('Invalid sort')) {
        return `The sort field provided is invalid for this collection. Available fields for the collection ${
          options.collectionName
        } are: ${fields
          .filter(field => field.isSortable)
          .map(field => field.field)
          .join(', ')}.`;
      }
    } catch (schemaError) {
      logger('Debug', `Failed to fetch schema for error enhancement: ${schemaError}`);
    }

    return errorMessage;
  };
}

export default function declareListRelatedTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const listArgumentShape = createHasManyArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'listRelated',
    {
      title: 'List records from a relation',
      description: 'Retrieve a list of records from a one-to-many or many-to-many relation.',
      inputSchema: listArgumentShape,
    },
    async (options: HasManyArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      const labelParts = [];

      if (options.search) {
        labelParts.push('search');
      }

      if (options.filters) {
        labelParts.push('filter');
      }

      const extraLabel = labelParts.length > 0 ? ` with ${labelParts.join(' and ')}` : '';

      return withActivityLog({
        forestServerUrl,
        request: extra,
        action: 'listRelatedData',
        context: {
          collectionName: options.collectionName,
          recordId: options.parentRecordId,
          label: `list relation "${options.relationName}"${extraLabel}`,
        },
        logger,
        operation: async () => {
          const relation = rpcClient
            .collection(options.collectionName)
            .relation(options.relationName, options.parentRecordId);

          let response: { records: unknown[]; totalCount?: number };

          if (options.enableCount) {
            const [records, totalCount] = await Promise.all([
              relation.list(options as SelectOptions),
              relation.count(options as SelectOptions),
            ]);
            response = { records, totalCount };
          } else {
            const records = await relation.list(options as SelectOptions);
            response = { records };
          }

          return { content: [{ type: 'text', text: JSON.stringify(response) }] };
        },
        errorEnhancer: createErrorEnhancer(forestServerUrl, options, logger),
      });
    },
    logger,
  );
}
