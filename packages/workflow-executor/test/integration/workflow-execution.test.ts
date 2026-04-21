import type { AgentPort } from '../../src/ports/agent-port';
import type { AiModelPort } from '../../src/ports/ai-model-port';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../../src/types/execution';
import type { CollectionSchema } from '../../src/types/record';
import type { BaseChatModel, RemoteTool } from '@forestadmin/ai-proxy';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { z } from 'zod';

import ExecutorHttpServer from '../../src/http/executor-http-server';
import Runner from '../../src/runner';
import SchemaCache from '../../src/schema-cache';
import InMemoryStore from '../../src/stores/in-memory-store';
import { StepType } from '../../src/types/step-definition';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH_SECRET = 'test-auth-secret';
const ENV_SECRET = 'a'.repeat(64);

const STEP_USER: StepUser = {
  id: 1,
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  team: 'Operations',
  renderingId: 1,
  role: 'admin',
  permissionLevel: 'admin',
  tags: {},
};

const COLLECTION_SCHEMA: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'email', displayName: 'Email', isRelationship: false },
    { fieldName: 'name', displayName: 'Name', isRelationship: false },
  ],
  actions: [],
};

const COLLECTION_SCHEMA_WITH_STATUS: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
  ],
  actions: [],
};

const COLLECTION_SCHEMA_WITH_ACTIONS: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [{ fieldName: 'id', displayName: 'Id', isRelationship: false }],
  actions: [
    { name: 'send_email', displayName: 'Send Email', endpoint: '/forest/actions/send-email' },
  ],
};

const COLLECTION_SCHEMA_WITH_RELATION: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    {
      fieldName: 'order',
      displayName: 'Order',
      isRelationship: true,
      relationType: 'BelongsTo',
      relatedCollectionName: 'orders',
    },
  ],
  actions: [],
};

const ORDERS_SCHEMA: CollectionSchema = {
  collectionName: 'orders',
  collectionDisplayName: 'Orders',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'total', displayName: 'Total', isRelationship: false },
  ],
  actions: [],
};

const BASE_RECORD_REF = { collectionName: 'customers', recordId: [42], stepIndex: 0 };

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function signToken(payload: object) {
  return jsonwebtoken.sign(payload, AUTH_SECRET, { expiresIn: '1h' });
}

function createMockModel(toolCallArgs: Record<string, unknown>): BaseChatModel {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: [{ name: 'read-selected-record-fields', args: toolCallArgs }],
  });

  return { invoke, bindTools: jest.fn().mockReturnThis() } as unknown as BaseChatModel;
}

function createSequentialMockModel(
  ...responses: Array<{ name: string; args: Record<string, unknown> }>
): BaseChatModel {
  const invoke = jest.fn();

  for (const resp of responses) {
    invoke.mockResolvedValueOnce({ tool_calls: [{ name: resp.name, args: resp.args }] });
  }

  return { invoke, bindTools: jest.fn().mockReturnThis() } as unknown as BaseChatModel;
}

function createMockAiClient(model: BaseChatModel): AiModelPort {
  return {
    getModel: jest.fn().mockReturnValue(model),
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiModelPort;
}

function createMockWorkflowPort(overrides: Partial<WorkflowPort> = {}): jest.Mocked<WorkflowPort> {
  return {
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn().mockResolvedValue(COLLECTION_SCHEMA),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
    hasRunAccess: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as jest.Mocked<WorkflowPort>;
}

function createMockAgentPort(): jest.Mocked<AgentPort> {
  return {
    getRecord: jest.fn().mockResolvedValue({
      collectionName: 'customers',
      recordId: [42],
      values: { id: 42, email: 'john@example.com', name: 'John Doe' },
    }),
    updateRecord: jest.fn().mockResolvedValue({
      collectionName: 'customers',
      recordId: [42],
      values: { id: 42, status: 'active' },
    }),
    getRelatedData: jest.fn().mockResolvedValue([]),
    executeAction: jest.fn().mockResolvedValue(undefined),
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: false }),
    probe: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<AgentPort>;
}

// ---------------------------------------------------------------------------
// Integration setup
// ---------------------------------------------------------------------------

function createIntegrationSetup(overrides?: {
  workflowPort?: jest.Mocked<WorkflowPort>;
  model?: BaseChatModel;
  agentPort?: jest.Mocked<AgentPort>;
  aiClient?: AiModelPort;
  pollingIntervalMs?: number;
}) {
  const model = overrides?.model ?? createMockModel({ fieldNames: ['Email'] });
  const aiClient = overrides?.aiClient ?? createMockAiClient(model);
  const workflowPort = overrides?.workflowPort ?? createMockWorkflowPort();
  const agentPort = overrides?.agentPort ?? createMockAgentPort();
  const runStore = new InMemoryStore();
  const schemaCache = new SchemaCache();

  const runner = new Runner({
    agentPort,
    workflowPort,
    runStore,
    schemaCache,
    aiModelPort: aiClient,
    activityLogPort: {
      createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    },
    pollingIntervalMs: overrides?.pollingIntervalMs ?? 60_000,
    envSecret: ENV_SECRET,
    authSecret: AUTH_SECRET,
  });

  const server = new ExecutorHttpServer({
    port: 0,
    runner,
    authSecret: AUTH_SECRET,
    workflowPort,
  });

  return { runner, server, workflowPort, agentPort, runStore, aiClient, model };
}

function buildPendingStep(
  overrides: Partial<PendingStepExecution> & Pick<PendingStepExecution, 'stepDefinition'>,
): PendingStepExecution {
  return {
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    baseRecordRef: BASE_RECORD_REF,
    previousSteps: [],
    user: STEP_USER,
    forestServerToken: 'test-forest-token',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workflow execution (integration)', () => {
  it('read-record happy path: trigger → AI selects field → read record → success', async () => {
    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue({
        runId: 'run-1',
        stepId: 'step-1',
        stepIndex: 0,
        baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
        stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer email' },
        previousSteps: [],
        user: STEP_USER,
      }),
    });

    const { server, agentPort, runStore } = createIntegrationSetup({ workflowPort });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // Act — the front triggers the step
    const response = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Assert — HTTP response
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ triggered: true });

    // Assert — orchestrator was notified with success
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        type: 'record',
        status: 'success',
        stepId: 'step-1',
        stepIndex: 0,
      }),
    );

    // Assert — agent was called to read the record
    expect(agentPort.getRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'customers',
        id: [42],
        fields: ['email'],
      }),
      expect.objectContaining({ id: STEP_USER.id }),
    );

    // Assert — step data was saved in the RunStore
    const steps = await runStore.getStepExecutions('run-1');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual(
      expect.objectContaining({
        type: 'read-record',
        stepIndex: 0,
        executionResult: {
          fields: [{ value: 'john@example.com', name: 'email', displayName: 'Email' }],
        },
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 1. Condition step: AI chooses an option → success
  // -------------------------------------------------------------------------

  it('condition: AI chooses an option → success', async () => {
    const model = createMockModel({
      option: 'Yes',
      reasoning: 'Customer is active',
      question: 'Is active?',
    });

    const step = buildPendingStep({
      stepDefinition: {
        type: StepType.Condition,
        options: ['Yes', 'No'],
        prompt: 'Is the customer active?',
      },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
    });

    const { server, runStore } = createIntegrationSetup({ workflowPort, model });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    const response = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);

    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        type: 'condition',
        status: 'success',
        stepId: 'step-1',
        stepIndex: 0,
        selectedOption: 'Yes',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 2. Update-record: awaiting-input → confirm → success
  // -------------------------------------------------------------------------

  it('update-record: awaiting-input → confirm → success', async () => {
    const model = createMockModel({
      fieldName: 'Status',
      value: 'active',
      reasoning: 'update status',
    });

    const step = buildPendingStep({
      stepDefinition: { type: StepType.UpdateRecord, prompt: 'Update the status' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
      getCollectionSchema: jest.fn().mockResolvedValue(COLLECTION_SCHEMA_WITH_STATUS),
    });

    const { server, agentPort, runStore } = createIntegrationSetup({ workflowPort, model });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // 1st trigger → awaiting-input
    const res1 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res1.status).toBe(200);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'awaiting-input' }),
    );

    // 2nd trigger with userConfirmed: true → success
    const res2 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({ pendingData: { userConfirmed: true } });

    expect(res2.status).toBe(200);
    expect(agentPort.updateRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'customers',
        id: [42],
        values: { status: 'active' },
      }),
      expect.objectContaining({ id: STEP_USER.id }),
    );
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'success' }),
    );
  });

  // -------------------------------------------------------------------------
  // 3. Trigger-action: awaiting-input → confirm → success
  // -------------------------------------------------------------------------

  it('trigger-action: awaiting-input → confirm → success', async () => {
    const model = createMockModel({
      actionName: 'Send Email',
      reasoning: 'send email',
    });

    const step = buildPendingStep({
      stepDefinition: { type: StepType.TriggerAction, prompt: 'Send the email' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
      getCollectionSchema: jest.fn().mockResolvedValue(COLLECTION_SCHEMA_WITH_ACTIONS),
    });

    const { server, agentPort, runStore } = createIntegrationSetup({ workflowPort, model });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // 1st trigger → awaiting-input
    const res1 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res1.status).toBe(200);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'awaiting-input' }),
    );

    // 2nd trigger with userConfirmed: true + actionResult (frontend executed the action itself)
    const res2 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pendingData: {
          userConfirmed: true,
          actionResult: { success: 'Email sent' },
        },
      });

    expect(res2.status).toBe(200);
    // Executor no longer re-runs the action — the frontend is the one that executed it.
    expect(agentPort.executeAction).not.toHaveBeenCalled();
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'success' }),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Load-related-record: BelongsTo → awaiting-input → confirm → success
  // -------------------------------------------------------------------------

  it('load-related-record: BelongsTo → awaiting-input → confirm → success', async () => {
    const model = createMockModel({
      relationName: 'Order',
      reasoning: 'load order',
    });

    const step = buildPendingStep({
      stepDefinition: { type: StepType.LoadRelatedRecord, prompt: 'Load the order' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
      getCollectionSchema: jest.fn().mockImplementation(async (collectionName: string) => {
        if (collectionName === 'orders') return ORDERS_SCHEMA;

        return COLLECTION_SCHEMA_WITH_RELATION;
      }),
    });

    const agentPort = createMockAgentPort();
    agentPort.getRelatedData.mockResolvedValue([
      { collectionName: 'orders', recordId: [99], values: { id: 99, total: 100 } },
    ]);

    const { server, runStore } = createIntegrationSetup({
      workflowPort,
      model,
      agentPort,
    });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // 1st trigger → awaiting-input
    const res1 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res1.status).toBe(200);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'awaiting-input' }),
    );

    // 2nd trigger with userConfirmed: true → success
    const res2 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({ pendingData: { userConfirmed: true } });

    expect(res2.status).toBe(200);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'success' }),
    );

    const steps = await runStore.getStepExecutions('run-1');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual(
      expect.objectContaining({
        type: 'load-related-record',
        executionResult: {
          relation: { name: 'order', displayName: 'Order' },
          record: { collectionName: 'orders', recordId: [99], stepIndex: 0 },
        },
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 5. MCP task: awaiting-input → confirm → success
  // -------------------------------------------------------------------------

  it('mcp: awaiting-input → confirm → success', async () => {
    const mcpToolInvoke = jest.fn().mockResolvedValue('OK');
    const fakeRemoteTool = {
      base: {
        name: 'send_notification',
        description: 'Send a notification',
        schema: z.object({ message: z.string() }),
        invoke: mcpToolInvoke,
      },
      sourceId: 'mcp-1',
      sourceType: 'mcp',
    } as unknown as RemoteTool;

    const model = createSequentialMockModel(
      { name: 'send_notification', args: { message: 'Hello' } },
      { name: 'summarize-result', args: { summary: 'Notification sent' } },
    );

    const aiClient = createMockAiClient(model);
    (aiClient.loadRemoteTools as jest.Mock).mockResolvedValue([fakeRemoteTool]);

    const step = buildPendingStep({
      stepDefinition: { type: StepType.Mcp, prompt: 'Send a notification' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
      getMcpServerConfigs: jest
        .fn()
        .mockResolvedValue([{ type: 'sse', configs: { 'mcp-1': { url: 'http://fake' } } }]),
    });

    const { server, runStore } = createIntegrationSetup({
      workflowPort,
      model,
      aiClient,
    });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // 1st trigger → awaiting-input
    const res1 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res1.status).toBe(200);
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'mcp', status: 'awaiting-input' }),
    );

    // 2nd trigger with userConfirmed: true → tool executed → success
    const res2 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({ pendingData: { userConfirmed: true } });

    expect(res2.status).toBe(200);
    expect(mcpToolInvoke).toHaveBeenCalledWith({ message: 'Hello' });
    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ type: 'mcp', status: 'success' }),
    );
  });

  // -------------------------------------------------------------------------
  // 6. User mismatch → 403
  // -------------------------------------------------------------------------

  it('user mismatch → HTTP 403', async () => {
    const step = buildPendingStep({
      stepDefinition: { type: StepType.ReadRecord, prompt: 'Read email' },
      user: { ...STEP_USER, id: 1 },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
    });

    const { server, runStore } = createIntegrationSetup({ workflowPort });
    await runStore.init();

    // Sign token with a different user id
    const token = signToken({ id: 999 });

    const response = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden' });
    expect(workflowPort.updateStepExecution).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 7. GET /runs/:runId after trigger returns saved step data
  // -------------------------------------------------------------------------

  it('GET /runs/:runId returns step data after trigger', async () => {
    const step = buildPendingStep({
      stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer email' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
    });

    const { server, runStore } = createIntegrationSetup({ workflowPort });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // Trigger the step first
    await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    // GET the run data
    const response = await request(server.callback)
      .get('/runs/run-1')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toEqual(
      expect.objectContaining({
        type: 'read-record',
        stepIndex: 0,
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 8. Run not found → 404
  // -------------------------------------------------------------------------

  it('run not found → HTTP 404', async () => {
    // Default mock returns null for getPendingStepExecutionsForRun
    const { server, runStore, workflowPort } = createIntegrationSetup();
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    const response = await request(server.callback)
      .post('/runs/run-unknown/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Run not found or unavailable' });
    expect(workflowPort.updateStepExecution).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 9. Skip step (userConfirmed: false) → success without side effects
  // -------------------------------------------------------------------------

  it('skip step (userConfirmed: false) → success without executing action', async () => {
    const model = createMockModel({
      fieldName: 'Status',
      value: 'active',
      reasoning: 'update status',
    });

    const step = buildPendingStep({
      stepDefinition: { type: StepType.UpdateRecord, prompt: 'Update the status' },
    });

    const workflowPort = createMockWorkflowPort({
      getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(step),
      getCollectionSchema: jest.fn().mockResolvedValue(COLLECTION_SCHEMA_WITH_STATUS),
    });

    const { server, agentPort, runStore } = createIntegrationSetup({ workflowPort, model });
    await runStore.init();

    const token = signToken({ id: STEP_USER.id });

    // 1st trigger → awaiting-input
    await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send();

    // 2nd trigger with userConfirmed: false → skip
    const res2 = await request(server.callback)
      .post('/runs/run-1/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({ pendingData: { userConfirmed: false } });

    expect(res2.status).toBe(200);
    expect(agentPort.updateRecord).not.toHaveBeenCalled();
    expect(workflowPort.updateStepExecution).toHaveBeenLastCalledWith(
      'run-1',
      expect.objectContaining({ type: 'record', status: 'success' }),
    );

    const steps = await runStore.getStepExecutions('run-1');
    expect(steps[0]).toEqual(expect.objectContaining({ executionResult: { skipped: true } }));
  });

  // -------------------------------------------------------------------------
  // 10. Polling executes a step
  // -------------------------------------------------------------------------

  it('polling executes a step', async () => {
    const model = createMockModel({ fieldNames: ['Email'] });

    const pendingStep = buildPendingStep({
      stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer email' },
    });

    const workflowPort = createMockWorkflowPort({
      // Return the step only on the first poll, then empty (to avoid re-execution loops)
      getPendingStepExecutions: jest
        .fn()
        .mockResolvedValueOnce([pendingStep])
        .mockResolvedValue([]),
    });

    const { runner, runStore } = createIntegrationSetup({
      workflowPort,
      model,
      pollingIntervalMs: 50,
    });

    await runStore.init();

    // Start the runner (no httpPort → no real server started)
    await runner.start();

    // Wait for the poll cycle to execute the step
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if ((workflowPort.updateStepExecution as jest.Mock).mock.calls.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    expect(workflowPort.updateStepExecution).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        type: 'record',
        status: 'success',
        stepId: 'step-1',
        stepIndex: 0,
      }),
    );

    await runner.stop();
  }, 10_000);
});
