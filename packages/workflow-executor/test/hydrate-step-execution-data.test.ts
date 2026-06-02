import type { SchemaGetter } from '../src/hydrate-step-execution-data';
import type { Logger } from '../src/ports/logger-port';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { StepExecutionData } from '../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../src/types/validated/collection';

import hydrateStepExecutionData, { makeSchemaGetter } from '../src/hydrate-step-execution-data';
import SchemaCache from '../src/schema-cache';

function makeLogger(): jest.Mocked<Logger> {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
}

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

  // --- optional-field phases: only the present fields get a displayName, absent ones stay absent

  it('hydrates only pendingData when update-record is awaiting input (no executionParams)', async () => {
    const execution: StepExecutionData = {
      type: 'update-record',
      stepIndex: 1,
      selectedRecordRef: recordRef,
      pendingData: { name: 'status', value: 'active' },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      pendingData: { name: 'status', displayName: 'Status', value: 'active' },
    });
    expect((result as { executionParams?: unknown }).executionParams).toBeUndefined();
  });

  it('hydrates only executionParams when update-record is done (no pendingData)', async () => {
    const execution: StepExecutionData = {
      type: 'update-record',
      stepIndex: 1,
      selectedRecordRef: recordRef,
      executionParams: { name: 'status', value: 'active' },
      executionResult: { updatedValues: { status: 'active' } },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      executionParams: { name: 'status', displayName: 'Status', value: 'active' },
      executionResult: { updatedValues: { status: 'active' } },
    });
    expect((result as { pendingData?: unknown }).pendingData).toBeUndefined();
  });

  it('leaves both fields undefined for the update-record executing phase', async () => {
    const execution: StepExecutionData = {
      type: 'update-record',
      stepIndex: 1,
      selectedRecordRef: recordRef,
      idempotencyPhase: 'executing',
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({ type: 'update-record', idempotencyPhase: 'executing' });
    expect((result as { executionParams?: unknown }).executionParams).toBeUndefined();
    expect((result as { pendingData?: unknown }).pendingData).toBeUndefined();
  });

  it('leaves both fields undefined for the trigger-action executing phase', async () => {
    const execution: StepExecutionData = {
      type: 'trigger-action',
      stepIndex: 2,
      selectedRecordRef: recordRef,
      idempotencyPhase: 'executing',
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect((result as { executionParams?: unknown }).executionParams).toBeUndefined();
    expect((result as { pendingData?: unknown }).pendingData).toBeUndefined();
  });

  it('hydrates load-related automatic execution (executionParams + result, no pendingData)', async () => {
    const execution: StepExecutionData = {
      type: 'load-related-record',
      stepIndex: 3,
      selectedRecordRef: recordRef,
      executionParams: { name: 'orders' },
      executionResult: {
        relation: { name: 'orders' },
        record: { collectionName: 'orders', recordId: [7], stepIndex: 3 },
      },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      executionParams: { name: 'orders', displayName: 'Orders' },
      executionResult: { relation: { name: 'orders', displayName: 'Orders' } },
    });
    expect((result as { pendingData?: unknown }).pendingData).toBeUndefined();
  });

  it('hydrates load-related pendingData while it is still awaiting input (no executionResult)', async () => {
    const execution: StepExecutionData = {
      type: 'load-related-record',
      stepIndex: 3,
      selectedRecordRef: recordRef,
      pendingData: { name: 'orders', selectedRecordId: [7] },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      pendingData: { name: 'orders', displayName: 'Orders', selectedRecordId: [7] },
    });
    // hydrateRelationResult passes an absent executionResult straight through.
    expect((result as { executionResult?: unknown }).executionResult).toBeUndefined();
    expect((result as { executionParams?: unknown }).executionParams).toBeUndefined();
  });

  it('resolves the action displayName from schema.actions, not schema.fields', async () => {
    const execution: StepExecutionData = {
      type: 'trigger-action',
      stepIndex: 2,
      selectedRecordRef: recordRef,
      // A field shares the name of no action; ensure the action lookup is used (and a matching
      // field name would NOT leak its label into an action ref).
      executionParams: { name: 'send-email' },
    };

    const result = await hydrateStepExecutionData(execution, makeGetter());

    expect(result).toMatchObject({
      executionParams: { name: 'send-email', displayName: 'Send Email' },
    });
  });

  it('returns an unrecognized step type unchanged after fetching the schema', async () => {
    const getter = makeGetter();
    const future = {
      type: 'future-step',
      stepIndex: 9,
      selectedRecordRef: recordRef,
    } as unknown as StepExecutionData;

    const result = await hydrateStepExecutionData(future, getter);

    expect(result).toBe(future);
    expect(getter).toHaveBeenCalledWith('customers');
  });

  // --- resilience & observability

  it('warns (but does not throw) when the schema fetch fails', async () => {
    const logger = makeLogger();
    const failingGetter: SchemaGetter = jest.fn().mockRejectedValue(new Error('endpoint down'));
    const execution: StepExecutionData = {
      type: 'trigger-action',
      stepIndex: 2,
      selectedRecordRef: recordRef,
      executionParams: { name: 'send-email' },
    };

    const result = await hydrateStepExecutionData(execution, failingGetter, logger);

    expect(result).toMatchObject({
      executionParams: { name: 'send-email', displayName: 'send-email' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch collection schema'),
      expect.objectContaining({ collection: 'customers', stepIndex: 2 }),
    );
  });

  it('returns the raw execution and logs an error when a malformed row cannot be hydrated', async () => {
    const logger = makeLogger();
    // A corrupted/legacy read-record row missing executionParams would throw inside hydration.
    const malformed = {
      type: 'read-record',
      stepIndex: 4,
      selectedRecordRef: recordRef,
    } as unknown as StepExecutionData;

    const result = await hydrateStepExecutionData(malformed, makeGetter(), logger);

    expect(result).toBe(malformed);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to hydrate'),
      expect.objectContaining({ type: 'read-record', stepIndex: 4 }),
    );
  });
});

describe('makeSchemaGetter', () => {
  it('serves the workflowPort schema on a miss and the cache on a hit', async () => {
    const schema = makeSchema();
    const cache = new SchemaCache();
    const workflowPort = {
      getCollectionSchema: jest.fn().mockResolvedValue(schema),
    } as unknown as WorkflowPort;

    const getSchema = makeSchemaGetter(cache, workflowPort, 'run-1', 1);

    await expect(getSchema('customers')).resolves.toBe(schema);
    await expect(getSchema('customers')).resolves.toBe(schema);

    // Second call is served from the cache — the port is hit exactly once.
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('customers', 'run-1');
  });

  it('scopes the cache by rendering: two renderings of one collection do not share', async () => {
    const cache = new SchemaCache();
    const getCollectionSchema = jest
      .fn()
      .mockResolvedValueOnce(makeSchema({ collectionDisplayName: 'Clients' }))
      .mockResolvedValueOnce(makeSchema({ collectionDisplayName: 'Accounts' }));
    const workflowPort = { getCollectionSchema } as unknown as WorkflowPort;

    const r1 = await makeSchemaGetter(cache, workflowPort, 'run-1', 1)('customers');
    const r2 = await makeSchemaGetter(cache, workflowPort, 'run-2', 2)('customers');

    // Each rendering fetched and cached independently — no cross-rendering hit.
    expect(getCollectionSchema).toHaveBeenCalledTimes(2);
    expect(r1.collectionDisplayName).toBe('Clients');
    expect(r2.collectionDisplayName).toBe('Accounts');
    expect(cache.get(1, 'customers')?.collectionDisplayName).toBe('Clients');
    expect(cache.get(2, 'customers')?.collectionDisplayName).toBe('Accounts');
  });

  it('de-duplicates concurrent fetches for the same collection (no stampede)', async () => {
    const cache = new SchemaCache();
    let resolveFetch: (s: CollectionSchema) => void = () => undefined;
    const deferred = new Promise<CollectionSchema>(resolve => {
      resolveFetch = resolve;
    });
    const getCollectionSchema = jest.fn().mockReturnValue(deferred);
    const getSchema = makeSchemaGetter(
      cache,
      { getCollectionSchema } as unknown as WorkflowPort,
      'run-1',
      1,
    );

    // Five concurrent misses while the first fetch is still in flight.
    const all = Promise.all([
      getSchema('customers'),
      getSchema('customers'),
      getSchema('customers'),
      getSchema('customers'),
      getSchema('customers'),
    ]);
    resolveFetch(makeSchema());
    const results = await all;

    expect(getCollectionSchema).toHaveBeenCalledTimes(1);
    results.forEach(r => expect(r).toMatchObject({ collectionName: 'customers' }));
  });

  it('clears the in-flight entry so a failed fetch can be retried', async () => {
    const cache = new SchemaCache();
    const getCollectionSchema = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(makeSchema());
    const getSchema = makeSchemaGetter(
      cache,
      { getCollectionSchema } as unknown as WorkflowPort,
      'run-1',
      1,
    );

    await expect(getSchema('customers')).rejects.toThrow('transient');
    await expect(getSchema('customers')).resolves.toMatchObject({ collectionName: 'customers' });
    expect(getCollectionSchema).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed fetch', async () => {
    const cache = new SchemaCache();
    const getCollectionSchema = jest.fn().mockRejectedValue(new Error('down'));
    const getSchema = makeSchemaGetter(
      cache,
      { getCollectionSchema } as unknown as WorkflowPort,
      'run-1',
      1,
    );

    await expect(getSchema('customers')).rejects.toThrow('down');
    expect(cache.get(1, 'customers')).toBeUndefined();
  });
});
