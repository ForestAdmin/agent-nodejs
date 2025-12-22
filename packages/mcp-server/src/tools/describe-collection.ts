import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import { Logger } from '../server.js';
import buildClient from '../utils/agent-caller.js';
import {
  fetchForestSchema,
  getActionsOfCollection,
  getFieldsOfCollection,
} from '../utils/schema-fetcher.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

interface DescribeCollectionArgument {
  collectionName: string;
}

function createDescribeCollectionArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
  };
}

export default function declareDescribeCollectionTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
): void {
  const argumentShape = createDescribeCollectionArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'describeCollection',
    {
      title: 'Describe a collection',
      description:
        'Get detailed information about a collection including its fields, data types, available filter operators, and relations to other collections. Use this tool first before querying data to understand the collection structure and build accurate filters.',
      inputSchema: argumentShape,
    },
    async (options: DescribeCollectionArgument, extra) => {
      const { rpcClient } = await buildClient(extra);

      // Get schema from forest server (relations, isFilterable, isSortable, etc.)
      const schema = await fetchForestSchema(forestServerUrl);
      const schemaFields = getFieldsOfCollection(schema, options.collectionName);

      // Try to get capabilities from agent (fields with types and operators)
      // This may fail on older agent versions
      let collectionCapabilities:
        | { fields: { name: string; type: string; operators: string[] }[] }
        | undefined;

      try {
        collectionCapabilities = await rpcClient.collection(options.collectionName).capabilities();
      } catch (error) {
        // Capabilities route not available, we'll use schema info only
        logger(
          'Warn',
          `Failed to fetch capabilities for collection ${options.collectionName}: ${error}`,
        );
      }

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
              operators: [], // Not available without capabilities route
              isPrimaryKey: schemaField.isPrimaryKey,
              isReadOnly: schemaField.isReadOnly,
              isRequired: schemaField.isRequired,
              isSortable: schemaField.isSortable || false,
            }));

      // Extract relations from schema
      const relations = schemaFields
        .filter(f => f.relationship)
        .map(f => {
          // reference format is "collectionName.fieldName"
          const targetCollection = f.reference?.split('.')[0] || null;

          let relationType: string;

          switch (f.relationship) {
            case 'HasMany':
              relationType = 'one-to-many';
              break;
            case 'BelongsToMany':
              relationType = 'many-to-many';
              break;
            case 'BelongsTo':
              relationType = 'many-to-one';
              break;
            case 'HasOne':
              relationType = 'one-to-one';
              break;
            default:
              relationType = f.relationship || 'unknown';
          }

          return {
            name: f.field,
            type: relationType,
            targetCollection,
          };
        });

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
      };

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    logger,
  );
}
