import type { Logger } from './ports/logger-port';
import type { WorkflowPort } from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type {
  DisplayedLoadRelatedRecordStepExecutionData,
  HydratedStepExecutionData,
  LoadRelatedRecordStepExecutionData,
  StepExecutionData,
} from './types/step-execution-data';
import type { CollectionSchema } from './types/validated/collection';

import { extractErrorMessage } from './errors';

// displayName is not persisted — it is rebuilt from the current schema so labels never go stale.

export type SchemaGetter = (collectionName: string) => Promise<CollectionSchema>;

// runId fetches the run's rendering server-side; renderingId scopes the cache.
export function makeSchemaGetter(
  schemaCache: SchemaCache,
  workflowPort: WorkflowPort,
  runId: string,
  renderingId: number,
): SchemaGetter {
  return (collectionName: string) =>
    schemaCache.getOrFetch(renderingId, collectionName, () =>
      workflowPort.getCollectionSchema(collectionName, runId),
    );
}

function fieldDisplayName(schema: CollectionSchema | null, name: string): string {
  return schema?.fields.find(f => f.fieldName === name)?.displayName ?? name;
}

function actionDisplayName(schema: CollectionSchema | null, name: string): string {
  return schema?.actions.find(a => a.name === name)?.displayName ?? name;
}

function hydrateRelationResult(
  result: LoadRelatedRecordStepExecutionData['executionResult'],
  schema: CollectionSchema | null,
): DisplayedLoadRelatedRecordStepExecutionData['executionResult'] {
  if (result === undefined) return undefined;
  if ('skipped' in result) return result;

  return {
    ...result,
    relation: { ...result.relation, displayName: fieldDisplayName(schema, result.relation.name) },
  };
}

// Split from the async wrapper so a throw on a malformed row can be caught and the raw execution
// returned instead of failing the whole read.
function hydrate(
  execution: Exclude<
    StepExecutionData,
    { type: 'condition' } | { type: 'mcp' } | { type: 'record' } | { type: 'guidance' }
  >,
  schema: CollectionSchema | null,
): HydratedStepExecutionData {
  switch (execution.type) {
    case 'read-record':
      return {
        ...execution,
        executionParams: {
          fields: execution.executionParams.fields.map(f => ({
            ...f,
            displayName: fieldDisplayName(schema, f.name),
          })),
        },
        executionResult: {
          fields: execution.executionResult.fields.map(f => ({
            ...f,
            displayName: fieldDisplayName(schema, f.name),
          })),
        },
      };

    case 'update-record':
      return {
        ...execution,
        executionParams: execution.executionParams && {
          ...execution.executionParams,
          displayName: fieldDisplayName(schema, execution.executionParams.name),
        },
        pendingData: execution.pendingData && {
          ...execution.pendingData,
          displayName: fieldDisplayName(schema, execution.pendingData.name),
        },
      };

    case 'trigger-action':
      return {
        ...execution,
        executionParams: execution.executionParams && {
          ...execution.executionParams,
          displayName: actionDisplayName(schema, execution.executionParams.name),
        },
        pendingData: execution.pendingData && {
          ...execution.pendingData,
          displayName: actionDisplayName(schema, execution.pendingData.name),
        },
      };

    case 'load-related-record':
      return {
        ...execution,
        pendingData: execution.pendingData && {
          ...execution.pendingData,
          displayName: fieldDisplayName(schema, execution.pendingData.name),
        },
        executionParams: execution.executionParams && {
          ...execution.executionParams,
          displayName: fieldDisplayName(schema, execution.executionParams.name),
        },
        executionResult: hydrateRelationResult(execution.executionResult, schema),
      };

    default:
      return execution;
  }
}

export default async function hydrateStepExecutionData(
  execution: StepExecutionData,
  getSchema: SchemaGetter,
  logger?: Logger,
): Promise<HydratedStepExecutionData> {
  if (
    execution.type === 'condition' ||
    execution.type === 'mcp' ||
    execution.type === 'record' ||
    execution.type === 'guidance'
  ) {
    return execution;
  }

  const { collectionName } = execution.selectedRecordRef;

  // A missing/renamed collection must not break a read — fall back to technical names.
  let schema: CollectionSchema | null = null;

  try {
    schema = await getSchema(collectionName);
  } catch (error) {
    logger?.warn(
      'Failed to fetch collection schema for displayName hydration; using technical names',
      {
        collection: collectionName,
        stepIndex: execution.stepIndex,
        error: extractErrorMessage(error),
      },
    );
    schema = null;
  }

  try {
    return hydrate(execution, schema);
  } catch (error) {
    logger?.error('Failed to hydrate step execution displayNames; returning the raw execution', {
      type: execution.type,
      stepIndex: execution.stepIndex,
      error: extractErrorMessage(error),
    });

    return execution as HydratedStepExecutionData;
  }
}
