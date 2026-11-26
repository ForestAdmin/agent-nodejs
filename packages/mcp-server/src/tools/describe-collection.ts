import type { Logger } from '../server';
import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { publishedRecordKeys, toWireOperator, withActivityLog } from '@forestadmin/agent-client';
import { z } from 'zod';

import { operatorEnum } from '../schemas/filter';
import buildClient, { activityLogConfigOf } from '../utils/agent-caller';
import getAuthContext from '../utils/auth-context';
import {
  fetchForestSchema,
  getActionsOfCollection,
  getFieldsOfCollection,
} from '../utils/schema-fetcher';
import {
  UNREACHABLE,
  actionDescriptionText,
  readSemanticLayer,
  withDescription,
} from '../utils/semantic-layer';
import toToolError from '../utils/tool-error';
import registerToolWithLogging from '../utils/tool-with-logging';

interface DescribeCollectionArgument {
  collectionName: string;
}

interface CollectionCapabilities {
  fields: { name: string; type: string; operators?: string[] }[];
}

const SNAKE_TO_PASCAL = new Map<string, string>(
  operatorEnum.options.map(operator => [toWireOperator(operator), operator]),
);

function toListOperators(
  operators: string[] | undefined,
  context: { collectionName: string; fieldName: string },
  logger: Logger,
): string[] | undefined {
  if (!operators) return undefined;

  return operators.flatMap(operator => {
    const listOperator = SNAKE_TO_PASCAL.get(operator);

    if (!listOperator) {
      logger(
        'Debug',
        `Operator ${operator} of ${context.collectionName}.${context.fieldName} is unknown to the list tool, not announced`,
      );

      return [];
    }

    return [listOperator];
  });
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
  ctx: ToolContext,
): string {
  const { forestServerClient, logger, collectionNames } = ctx;
  const argumentShape = createDescribeCollectionArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'describeCollection',
    {
      annotations: { readOnlyHint: true },
      title: 'Describe a collection',
      description: `Discover a collection's schema: fields, types, operators, relations, and available actions. Always call this first before querying or modifying data.

Actions properties:
- type: 'single' (requires one record), 'bulk' (multiple records), 'global' (no record needed)
- hasForm: true if action requires form input (use getActionForm to see fields)
- download: true if action returns a file download (not executable via AI)

Field names: every field name you send (filters, sort, \`fields\`, \`relation:field\`, \`relation@@@field\`, create/update attributes) is the schema \`name\`. A field or relation with a \`recordKey\` comes back under that key in a returned record; it only says where to read the value, never send it. Fields sharing a \`recordKey\` (listed in \`sharesRecordKeyWith\`) can be read only when a single one of them is projected in the call. \`recordKey: null\` means the value cannot be read from a returned record: never read it under its name. Every record carries \`id\`, the record identifier, which is not a schema field. A related record's values sit under the related collection's record keys (call describeCollection on it).

Descriptions: the collection, a field, a relation, an action or a workflow carries a \`description\` only when one is written; read it to pick the right one. \`workflows\` lists the workflows you can start on this collection with triggerWorkflow.

Polymorphic relations (isPolymorphic=true) point to multiple collections. When creating/updating, you must set both the _id and _type fields (e.g. commentable_id and commentable_type).

Check \`_meta\` for data availability context.`,
      inputSchema: argumentShape,
    },
    async (options: DescribeCollectionArgument, extra) => {
      const { rpcClient } = buildClient(extra, ctx);

      try {
        return await withActivityLog(
          activityLogConfigOf(extra, ctx),
          { action: 'describeCollection', collectionName: options.collectionName },
          async () => {
            const schema = await fetchForestSchema(forestServerClient);
            const schemaFields = getFieldsOfCollection(schema, options.collectionName);

            const descriptions = await readSemanticLayer(extra, logger, caller =>
              forestServerClient.getSemanticLayerCollection({
                ...caller,
                collectionName: options.collectionName,
              }),
            );

            if (descriptions === UNREACHABLE) {
              throw new Error(`Collection "${options.collectionName}" not found in schema`);
            }

            const fieldDescription = (name: string) =>
              withDescription(descriptions?.fields[name]?.text);

            // Try to get capabilities from agent (may be unavailable on older versions)
            const collectionCapabilities = await tryFetchCapabilities(
              rpcClient,
              options.collectionName,
              logger,
            );

            const schemaFieldNames = schemaFields.map(f => f.field);
            const capabilityOnlyNames = (collectionCapabilities?.fields ?? [])
              .map(capField => capField.name)
              .filter(name => !schemaFieldNames.includes(name));
            const recordKeys = publishedRecordKeys([...schemaFieldNames, ...capabilityOnlyNames]);

            const withRecordKey = (name: string) => recordKeys.get(name) ?? {};

            const fields = collectionCapabilities?.fields
              ? collectionCapabilities.fields.map(capField => {
                  const schemaField = schemaFields.find(f => f.field === capField.name);

                  return {
                    name: capField.name,
                    ...withRecordKey(capField.name),
                    ...fieldDescription(capField.name),
                    type: capField.type,
                    operators: toListOperators(
                      capField.operators,
                      { collectionName: options.collectionName, fieldName: capField.name },
                      logger,
                    ),
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
                    ...withRecordKey(schemaField.field),
                    ...fieldDescription(schemaField.field),
                    type: schemaField.type,
                    operators: null, // Not available without capabilities route
                    isPrimaryKey: schemaField.isPrimaryKey,
                    isReadOnly: schemaField.isReadOnly,
                    isRequired: schemaField.isRequired,
                    isSortable: schemaField.isSortable || false,
                  }));

            const relations = schemaFields
              .filter(f => f.relationship)
              .map(f => {
                const polymorphicTargets = f.polymorphicReferencedModels;
                const isPolymorphic =
                  Array.isArray(polymorphicTargets) && polymorphicTargets.length > 0;

                return {
                  name: f.field,
                  ...withRecordKey(f.field),
                  ...fieldDescription(f.field),
                  type: mapRelationType(f.relationship),
                  targetCollection: isPolymorphic ? null : f.reference?.split('.')[0] || null,
                  ...(isPolymorphic && { isPolymorphic: true, polymorphicTargets }),
                };
              });

            const schemaActions = getActionsOfCollection(schema, options.collectionName);

            const actionDescription = (action: { name: string; description?: string }) => {
              if (!descriptions) return action.description;

              const forest = descriptions.actions[action.name];

              return forest && actionDescriptionText(forest, action.description);
            };

            const actions = schemaActions
              .filter(action => action.endpoint)
              .map(action => ({
                name: action.name,
                type: action.type, // 'single', 'bulk', or 'global'
                ...withDescription(actionDescription(action)),
                hasForm: action.fields.length > 0 || action.hooks.load,
                download: action.download,
              }));

            const skippedActions = schemaActions
              .filter(action => !action.endpoint)
              .map(action => ({ name: action.name, reason: 'no endpoint configured' }));

            const { forestServerToken, renderingId } = getAuthContext(extra);
            let mcpWorkflows: { workflowId: string; name: string }[] = [];

            try {
              mcpWorkflows = await forestServerClient.listMcpEnabledWorkflows({
                forestServerToken,
                renderingId,
                collectionName: options.collectionName,
              });
            } catch (error) {
              logger('Warn', `Workflows of ${options.collectionName} not listed: ${error}`);
            }

            const workflows = mcpWorkflows.map(workflow => ({
              id: workflow.workflowId,
              name: workflow.name,
              ...withDescription(
                descriptions?.workflows.find(described => described.id === workflow.workflowId)
                  ?.description.text,
              ),
            }));

            const result = {
              collection: options.collectionName,
              ...withDescription(descriptions?.collection.text),
              fields,
              relations,
              actions,
              workflows,
              _meta: {
                capabilitiesAvailable: !!collectionCapabilities,
                descriptionsAvailable: descriptions !== undefined,
                ...(collectionCapabilities
                  ? {}
                  : {
                      note: 'Operators unavailable (older agent version). Fields have operators: null.',
                    }),
                ...(skippedActions.length > 0 && { skippedActions }),
              },
            };

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          },
        );
      } catch (error) {
        throw await toToolError(error, { logger });
      }
    },
    logger,
  );
}
