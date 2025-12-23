import type { ListArgument } from './list.js';
import type { SelectOptions } from '@forestadmin/agent-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

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

/**
 * Enhances error messages with helpful context about available relations and sortable fields.
 * Returns an enhanced error or the original error if enhancement fails.
 */
async function enhanceErrorWithContext(
  error: unknown,
  forestServerUrl: string,
  options: HasManyArgument,
): Promise<Error> {
  const errorDetail = parseAgentError(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

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
      return new Error(
        `The relation name provided is invalid for this collection. Available relations for collection ${
          options.collectionName
        } are: ${toManyRelations.map(field => field.field).join(', ')}.`,
      );
    }

    if (errorDetail?.includes('Invalid sort')) {
      return new Error(
        `The sort field provided is invalid for this collection. Available fields for the collection ${
          options.collectionName
        } are: ${fields
          .filter(field => field.isSortable)
          .map(field => field.field)
          .join(', ')}.`,
      );
    }
  } catch {
    // Schema fetch failed, fall through to return original error
  }

  return errorDetail ? new Error(errorDetail) : (error as Error);
}

export default function declareListRelatedTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const listArgumentShape = createHasManyArgumentShape(collectionNames);

  registerToolWithLogging(
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

      await createActivityLog(forestServerUrl, extra, 'listRelatedData', {
        collectionName: options.collectionName,
        recordId: options.parentRecordId,
        label: `list relation "${options.relationName}"${extraLabel}`,
      });

      try {
        const relation = rpcClient
          .collection(options.collectionName)
          .relation(options.relationName, options.parentRecordId);

        if (options.enableCount) {
          const [records, totalCount] = await Promise.all([
            relation.list(options as SelectOptions),
            relation.count(options as SelectOptions),
          ]);

          return { content: [{ type: 'text', text: JSON.stringify({ records, totalCount }) }] };
        }

        const records = await relation.list(options as SelectOptions);

        return { content: [{ type: 'text', text: JSON.stringify({ records }) }] };
      } catch (error) {
        throw await enhanceErrorWithContext(error, forestServerUrl, options);
      }
    },
    logger,
  );
}
