import type { McpHttpClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import buildClient from '../utils/agent-caller';
import {
  fetchForestSchema,
  getActionsOfCollection,
  getFieldsOfCollection,
} from '../utils/schema-fetcher';
import registerToolWithLogging from '../utils/tool-with-logging';
import withActivityLog from '../utils/with-activity-log';

interface DescribeCollectionArgument {
  collectionName: string;
}

interface CollectionCapabilities {
  fields: { name: string; type: string; operators: string[] }[];
}

function createDescribeCollectionArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
  };
}

/**
 * Try to fetch capabilities from the agent.
 * Returns undefined if the route is not available (older agent versions).
 * Throws for unexpected errors (network, 500, etc.).
 */
async function tryFetchCapabilities(
  rpcClient: ReturnType<typeof buildClient>['rpcClient'],
  collectionName: string,
  logger: Logger,
): Promise<CollectionCapabilities | undefined> {
  try {
    const capabilities = await rpcClient.collection(collectionName).capabilities();

    return capabilities;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const is404 = errorMessage.includes('404') || errorMessage.includes('Not Found');

    if (is404) {
      logger(
        'Debug',
        `Capabilities route not available for collection ${collectionName}, using schema fallback`,
      );

      return undefined;
    }

    logger('Error', `Failed to fetch capabilities for collection ${collectionName}: ${error}`);
    throw error;
  }
}

/**
 * Maps Forest Admin relationship types to simpler relation type names.
 */
function mapRelationType(relationship: string | undefined): string {
  switch (relationship) {
    case 'HasMany':
      return 'one-to-many';
    case 'BelongsToMany':
      return 'many-to-many';
    case 'BelongsTo':
      return 'many-to-one';
    case 'HasOne':
      return 'one-to-one';
    default:
      return relationship || 'unknown';
  }
}

export default function declareDescribeCollectionTool(
  mcpServer: McpServer,
  httpClient: McpHttpClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createDescribeCollectionArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'describeCollection',
    {
      title: 'Describe a collection',
      description:
        "Discover a collection's schema: fields, types, operators, relations, and available actions. Always call this first before querying or modifying data. Check `_meta` for data availability context.",
      inputSchema: argumentShape,
    },
    async (options: DescribeCollectionArgument, extra) => {
      const { rpcClient } = buildClient(extra);

      return withActivityLog({
        httpClient,
        request: extra,
        action: 'describeCollection',
        context: { collectionName: options.collectionName },
        logger,
        operation: async () => {
          // Get schema from forest server (relations, isFilterable, isSortable, etc.)
          const schema = await fetchForestSchema(httpClient);
          const schemaFields = getFieldsOfCollection(schema, options.collectionName);

          // Try to get capabilities from agent (may be unavailable on older versions)
          const collectionCapabilities = await tryFetchCapabilities(
            rpcClient,
            options.collectionName,
            logger,
          );

          // Build fields array - use capabilities if available, otherwise fall back to schema
          const fields = collectionCapabilities?.fields
            ? collectionCapabilities.fields.map(capField => {
                const schemaField = schemaFields.find(f => f.field === capField.name);

                return {
                  name: capField.name,
                  type: capField.type,
                  operators: capField.operators,
                  isPrimaryKey: schemaField?.isPrimaryKey || false,
                  isReadOnly: schemaField?.isReadOnly || false,
                  isRequired: schemaField?.isRequired || false,
                  isSortable: schemaField?.isSortable || false,
                };
              })
            : schemaFields
                .filter(f => !f.relationship) // Only non-relation fields
                .map(schemaField => ({
                  name: schemaField.field,
                  type: schemaField.type,
                  operators: null, // Not available without capabilities route
                  isPrimaryKey: schemaField.isPrimaryKey,
                  isReadOnly: schemaField.isReadOnly,
                  isRequired: schemaField.isRequired,
                  isSortable: schemaField.isSortable || false,
                }));

          // Extract relations from schema
          const relations = schemaFields
            .filter(f => f.relationship)
            .map(f => ({
              name: f.field,
              type: mapRelationType(f.relationship),
              targetCollection: f.reference?.split('.')[0] || null,
            }));

          // Extract actions from schema
          const schemaActions = getActionsOfCollection(schema, options.collectionName);
          const actions = schemaActions.map(action => ({
            name: action.name,
            type: action.type, // 'single', 'bulk', or 'global'
            description: action.description || null,
            hasForm: action.fields.length > 0 || action.hooks.load,
            download: action.download,
          }));

          const result = {
            collection: options.collectionName,
            fields,
            relations,
            actions,
            _meta: {
              capabilitiesAvailable: !!collectionCapabilities,
              ...(collectionCapabilities
                ? {}
                : {
                    note: 'Operators unavailable (older agent version). Fields have operators: null.',
                  }),
            },
          };

          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
      });
    },
    logger,
  );
}
