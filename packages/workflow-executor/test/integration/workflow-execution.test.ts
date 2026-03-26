import type { AgentPort } from '../../src/ports/agent-port';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { StepUser } from '../../src/types/execution';
import type { CollectionSchema } from '../../src/types/record';
import type { AiClient, BaseChatModel } from '@forestadmin/ai-proxy';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

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

function createMockAiClient(model: BaseChatModel): AiClient {
  return {
    getModel: jest.fn().mockReturnValue(model),
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiClient;
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
    updateRecord: jest.fn().mockResolvedValue(undefined),
    getRelatedData: jest.fn().mockResolvedValue([]),
    executeAction: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<AgentPort>;
}

// ---------------------------------------------------------------------------
// Integration setup
// ---------------------------------------------------------------------------

function createIntegrationSetup(overrides?: {
  workflowPort?: jest.Mocked<WorkflowPort>;
  model?: BaseChatModel;
}) {
  const model = overrides?.model ?? createMockModel({ fieldNames: ['Email'] });
  const aiClient = createMockAiClient(model);
  const workflowPort = overrides?.workflowPort ?? createMockWorkflowPort();
  const agentPort = createMockAgentPort();
  const runStore = new InMemoryStore();
  const schemaCache = new SchemaCache();

  const runner = new Runner({
    agentPort,
    workflowPort,
    runStore,
    schemaCache,
    aiClient,
    pollingIntervalMs: 60_000,
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
        type: 'record-task',
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
});
