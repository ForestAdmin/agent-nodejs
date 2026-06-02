import type { SchemaGetter } from '../src/hydrate-step-execution-data';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { StepExecutionData } from '../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../src/types/validated/collection';

import hydrateStepExecutionData, { makeSchemaGetter } from '../src/hydrate-step-execution-data';
import SchemaCache from '../src/schema-cache';

function makeSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'status', displayName: 'Status', isRelationship: false },
      { fieldName: 'email', displayName: 'Email', isRelationship: false },
      {
        fieldName: 'orders',
        displayName: 'Orders',
        isRelationship: true,
        relationType: 'HasMany',
        relatedCollectionName: 'orders',
      },
    ],
    actions: [{ name: 'send-email', displayName: 'Send Email', endpoint: '/forest/send' }],
    ...overrides,
  };
}

const recordRef: RecordRef = { collectionName: 'customers', recordId: [42], stepIndex: 0 };

// A getter that always returns the same schema, recording which collections were requested.
function makeGetter(schema: CollectionSchema = makeSchema()): SchemaGetter & jest.Mock {
  return jest.fn().mockResolvedValue(schema) as SchemaGetter & jest.Mock;
}

describe('hydrateStepExecutionData', () => {
  it('re-derives the field displayName for update-record params and pending data', async () => {
    const execution: StepExecutionData = {
      type: 'update-record',
      stepIndex: 1,
      selectedRecordRef: recordRef,
      executionParams: { name: 'status', value: 'active' },
      pendingData: { name: 'status', value: 'active' },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      type: 'update-record',
      executionParams: { name: 'status', displayName: 'Status', value: 'active' },
      pendingData: { name: 'status', displayName: 'Status', value: 'active' },
    });
  });

  it('re-derives the action displayName for trigger-action', async () => {
    const execution: StepExecutionData = {
      type: 'trigger-action',
      stepIndex: 2,
      selectedRecordRef: recordRef,
      executionParams: { name: 'send-email' },
      pendingData: { name: 'send-email' },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      executionParams: { name: 'send-email', displayName: 'Send Email' },
      pendingData: { name: 'send-email', displayName: 'Send Email' },
    });
  });

  it('re-derives field displayNames for every read-record field (success and error)', async () => {
    const execution: StepExecutionData = {
      type: 'read-record',
      stepIndex: 0,
      selectedRecordRef: recordRef,
      executionParams: { fields: [{ name: 'email' }, { name: 'ghost' }] },
      executionResult: {
        fields: [
          { name: 'email', value: 'a@b.c' },
          { name: 'ghost', error: 'Field not found: ghost' },
        ],
      },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      executionParams: {
        fields: [
          { name: 'email', displayName: 'Email' },
          // Unknown field falls back to its technical name.
          { name: 'ghost', displayName: 'ghost' },
        ],
      },
      executionResult: {
        fields: [
          { name: 'email', displayName: 'Email', value: 'a@b.c' },
          { name: 'ghost', displayName: 'ghost', error: 'Field not found: ghost' },
        ],
      },
    });
  });

  it('re-derives the relation displayName for load-related-record params, pending and result', async () => {
    const execution: StepExecutionData = {
      type: 'load-related-record',
      stepIndex: 3,
      selectedRecordRef: recordRef,
      pendingData: { name: 'orders', selectedRecordId: [7] },
      executionParams: { name: 'orders' },
      executionResult: {
        relation: { name: 'orders' },
        record: { collectionName: 'orders', recordId: [7], stepIndex: 3 },
      },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      pendingData: { name: 'orders', displayName: 'Orders', selectedRecordId: [7] },
      executionParams: { name: 'orders', displayName: 'Orders' },
      executionResult: {
        relation: { name: 'orders', displayName: 'Orders' },
        record: { collectionName: 'orders', recordId: [7] },
      },
    });
  });

  it('reflects a CHANGED schema rather than any previously persisted label', async () => {
    const execution: StepExecutionData = {
      type: 'update-record',
      stepIndex: 1,
      selectedRecordRef: recordRef,
      // Simulate an old row that still carries a (now stale) displayName alongside the name.
      executionParams: { name: 'status', value: 'active', displayName: 'OLD LABEL' } as never,
    };
    const renamed = makeSchema({
      fields: [{ fieldName: 'status', displayName: 'Lifecycle Stage', isRelationship: false }],
    });

    const result = await hydrateStepExecutionData(execution, makeGetter(renamed));

    // The stale 'OLD LABEL' is ignored; the label is rebuilt from the (renamed) schema.
    expect(result).toMatchObject({
      type: 'update-record',
      executionParams: { name: 'status', displayName: 'Lifecycle Stage' },
    });
  });

  it('falls back to technical names when the schema cannot be fetched', async () => {
    const execution: StepExecutionData = {
      type: 'trigger-action',
      stepIndex: 2,
      selectedRecordRef: recordRef,
      executionParams: { name: 'send-email' },
    };
    const failingGetter: SchemaGetter = jest.fn().mockRejectedValue(new Error('boom'));

    const result = await hydrateStepExecutionData(execution, failingGetter);

    expect(result).toMatchObject({
      executionParams: { name: 'send-email', displayName: 'send-email' },
    });
  });

  it('returns condition / mcp / guidance / record executions unchanged without fetching a schema', async () => {
    const getter = makeGetter();
    const condition: StepExecutionData = {
      type: 'condition',
      stepIndex: 0,
      executionParams: { answer: 'yes' },
    };

    const result = await hydrateStepExecutionData(condition, getter);

    expect(result).toEqual(condition);
    expect(getter).not.toHaveBeenCalled();
  });

  it('leaves a skipped load-related result untouched', async () => {
    const execution: StepExecutionData = {
      type: 'load-related-record',
      stepIndex: 3,
      selectedRecordRef: recordRef,
      executionResult: { skipped: true },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({ executionResult: { skipped: true } });
  });
});

describe('makeSchemaGetter', () => {
  it('serves the workflowPort schema on a miss and the cache on a hit', async () => {
    const schema = makeSchema();
    const cache = new SchemaCache();
    const workflowPort = {
      getCollectionSchema: jest.fn().mockResolvedValue(schema),
    } as unknown as WorkflowPort;

    const getSchema = makeSchemaGetter(cache, workflowPort, 'run-1');

    await expect(getSchema('customers')).resolves.toBe(schema);
    await expect(getSchema('customers')).resolves.toBe(schema);

    // Second call is served from the cache — the port is hit exactly once.
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('customers', 'run-1');
  });
});
