/* eslint-disable no-console */

/**
 * Demo script — Customer Onboarding workflow with 5 steps.
 *
 * Usage:
 *   npx ts-node packages/workflow-executor/demo/demo.ts
 *   Open http://localhost:3100
 */

import type { WorkflowPort } from '../src/ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../src/types/execution';
import type { CollectionSchema } from '../src/types/record';
import type { StepOutcome } from '../src/types/step-outcome';
import type { AiClient, BaseChatModel, RemoteTool } from '@forestadmin/ai-proxy';

import fs from 'fs';
import http from 'http';
import path from 'path';

import jsonwebtoken from 'jsonwebtoken';

import Runner from '../src/runner';
import SchemaCache from '../src/schema-cache';
import InMemoryStore from '../src/stores/in-memory-store';
import { StepType } from '../src/types/step-definition';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AUTH_SECRET = 'demo-auth-secret-for-testing-only';
const ENV_SECRET = 'a'.repeat(64);
const HTTP_PORT = 3100;
const RUN_ID = 'demo-1';

// Static token (1 year)
const DEMO_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGZvcmVzdGFkbWluLmNvbSIsImlhdCI6MTc3NDUzNDAzOCwiZXhwIjoxODA2MDcwMDM4fQ.CZAHRCr2Jj1hIdE3rCFRadnOMjA9NyS64aZEao0oHv0';

const DEMO_USER: StepUser = {
  id: 1,
  email: 'demo@forestadmin.com',
  firstName: 'Demo',
  lastName: 'User',
  team: 'Product',
  renderingId: 1,
  role: 'admin',
  permissionLevel: 'admin',
  tags: {},
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CUSTOMERS_SCHEMA: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'email', displayName: 'Email', isRelationship: false },
    { fieldName: 'name', displayName: 'Full Name', isRelationship: false },
    { fieldName: 'company', displayName: 'Company', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
    { fieldName: 'accepted_cgv', displayName: 'Accepted CGV', isRelationship: false },
    {
      fieldName: 'orders',
      displayName: 'Orders',
      isRelationship: true,
      relationType: 'HasMany',
      relatedCollectionName: 'orders',
    },
  ],
  actions: [
    {
      name: 'send_welcome_email',
      displayName: 'Send Welcome Email',
      endpoint: '/forest/actions/send-welcome-email',
    },
  ],
};

const ORDERS_SCHEMA: CollectionSchema = {
  collectionName: 'orders',
  collectionDisplayName: 'Orders',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'reference', displayName: 'Reference', isRelationship: false },
    { fieldName: 'total', displayName: 'Total', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
  ],
  actions: [],
};

// ---------------------------------------------------------------------------
// 5-step workflow
// ---------------------------------------------------------------------------

interface WorkflowStepDef {
  step: Omit<PendingStepExecution, 'previousSteps'>;
  aiResponses: Array<{ name: string; args: Record<string, unknown> }>;
}

const WORKFLOW_STEPS: WorkflowStepDef[] = [
  // Step 0: Read customer info
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-read',
      stepIndex: 0,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer name, email, and company' },
      user: DEMO_USER,
    },
    aiResponses: [
      { name: 'read-selected-record-fields', args: { fieldNames: ['Full Name', 'Email', 'Company'] } },
    ],
  },

  // Step 1: Condition — did the customer accept CGV?
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-condition',
      stepIndex: 1,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: StepType.Condition,
        options: ['Yes — CGV accepted', 'No — CGV not accepted'],
        prompt: 'Has the customer accepted the terms and conditions?',
      },
      user: DEMO_USER,
    },
    aiResponses: [
      {
        name: 'choose-gateway-option',
        args: {
          option: 'Yes — CGV accepted',
          reasoning: 'Customer accepted_cgv field is true',
          question: 'CGV status check',
        },
      },
    ],
  },

  // Step 2: Update status to "active"
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-update',
      stepIndex: 2,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: StepType.UpdateRecord,
        prompt: 'Activate the customer by setting status to active',
      },
      user: DEMO_USER,
    },
    aiResponses: [
      {
        name: 'update-record-field',
        args: { fieldName: 'Status', value: 'active', reasoning: 'Activating new customer after CGV acceptance' },
      },
    ],
  },

  // Step 3: Send welcome email
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-email',
      stepIndex: 3,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: StepType.TriggerAction,
        prompt: 'Send the welcome email to the customer',
      },
      user: DEMO_USER,
    },
    aiResponses: [
      {
        name: 'select-action',
        args: { actionName: 'Send Welcome Email', reasoning: 'Welcome new active customer' },
      },
    ],
  },

  // Step 4: Load related order
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-load-order',
      stepIndex: 4,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        prompt: 'Load the customer first order',
      },
      user: DEMO_USER,
    },
    aiResponses: [
      { name: 'select-relation', args: { relationName: 'Orders', reasoning: 'Load first order for onboarding' } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Fake WorkflowPort
// ---------------------------------------------------------------------------

class FakeWorkflowPort implements WorkflowPort {
  private currentStepIndex = 0;
  private outcomes: StepOutcome[] = [];

  getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    if (runId !== RUN_ID) return Promise.resolve(null);
    if (this.currentStepIndex >= WORKFLOW_STEPS.length) return Promise.resolve(null);

    const { step } = WORKFLOW_STEPS[this.currentStepIndex];
    const previousSteps = this.outcomes.map((outcome, i) => ({
      stepDefinition: WORKFLOW_STEPS[i].step.stepDefinition,
      stepOutcome: outcome,
    }));

    return Promise.resolve({ ...step, previousSteps } as PendingStepExecution);
  }

  async updateStepExecution(_runId: string, outcome: StepOutcome): Promise<void> {
    const emoji = outcome.status === 'success' ? '✅' : outcome.status === 'error' ? '❌' : '⏳';
    console.log(`  ${emoji} Step ${outcome.stepIndex} → ${outcome.status}`);

    if (outcome.status === 'success' || outcome.status === 'error') {
      this.outcomes.push(outcome);
      this.currentStepIndex += 1;

      if (this.currentStepIndex >= WORKFLOW_STEPS.length) {
        console.log('\n  🎉 Workflow completed!\n');
      }
    }
  }

  getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    return Promise.resolve([]);
  }

  getCollectionSchema(name: string): Promise<CollectionSchema> {
    if (name === 'orders') return Promise.resolve(ORDERS_SCHEMA);

    return Promise.resolve(CUSTOMERS_SCHEMA);
  }

  getMcpServerConfigs(): Promise<[]> {
    return Promise.resolve([]);
  }

  hasRunAccess(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

// ---------------------------------------------------------------------------
// Mock AI — returns pre-defined tool calls per step
// ---------------------------------------------------------------------------

function createDemoAiClient(): AiClient {
  let globalCallIndex = 0;

  // Flatten all AI responses in order
  const allResponses = WORKFLOW_STEPS.flatMap(s => s.aiResponses);

  const model = {
    bindTools: () => model,
    invoke: () => {
      const idx = Math.min(globalCallIndex, allResponses.length - 1);
      const response = allResponses[idx];
      globalCallIndex += 1;

      // Small delay to make it feel like AI is thinking
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ tool_calls: [{ name: response.name, args: response.args }] });
        }, 300);
      });
    },
  } as unknown as BaseChatModel;

  return {
    getModel: () => model,
    loadRemoteTools: () => Promise.resolve([] as RemoteTool[]),
    closeConnections: () => Promise.resolve(),
  } as unknown as AiClient;
}

// ---------------------------------------------------------------------------
// Mock AgentPort
// ---------------------------------------------------------------------------

const agentPort = {
  getRecord: () => {
    console.log('  📖 Reading customer record...');

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          collectionName: 'customers',
          recordId: [42],
          values: {
            id: 42,
            email: 'jane.doe@acme.com',
            name: 'Jane Doe',
            company: 'Acme Corp',
            status: 'pending',
            accepted_cgv: true,
          },
        });
      }, 200);
    });
  },
  updateRecord: () => {
    console.log('  ✏️  Updating customer status → active');

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          collectionName: 'customers',
          recordId: [42],
          values: { id: 42, status: 'active' },
        });
      }, 300);
    });
  },
  getRelatedData: () => {
    console.log('  🔗 Loading related orders...');

    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          {
            collectionName: 'orders',
            recordId: [1001],
            values: {
              id: 1001,
              reference: 'ORD-2024-1001',
              total: 2499.99,
              status: 'confirmed',
            },
          },
        ]);
      }, 250);
    });
  },
  executeAction: () => {
    console.log('  📧 Sending welcome email...');

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true });
      }, 400);
    });
  },
};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const workflowPort = new FakeWorkflowPort();
  const runStore = new InMemoryStore();
  const schemaCache = new SchemaCache();

  const runner = new Runner({
    agentPort: agentPort as any,
    workflowPort,
    runStore,
    schemaCache,
    aiClient: createDemoAiClient(),
    pollingIntervalMs: 60_000,
    envSecret: ENV_SECRET,
    authSecret: AUTH_SECRET,
  });

  await runStore.init();

  const { default: ExecutorHttpServer } = await import('../src/http/executor-http-server');
  const executorServer = new ExecutorHttpServer({
    port: 0,
    runner,
    authSecret: AUTH_SECRET,
    workflowPort,
  });
  const executorApp = executorServer.callback;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const htmlPath = path.join(__dirname, 'demo.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');
      html = html.replace('__DEMO_TOKEN__', DEMO_TOKEN);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);

      return;
    }

    executorApp(req, res);
  });

  server.listen(HTTP_PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║   🌲 Workflow Executor — Demo Server         ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🌐 http://localhost:${HTTP_PORT}`);
    console.log('');
    console.log('  Workflow: Customer Onboarding (5 steps)');
    WORKFLOW_STEPS.forEach((s, i) => {
      const types: Record<string, string> = {
        'read-record': '📖',
        condition: '🔀',
        'update-record': '✏️',
        'trigger-action': '📧',
        'load-related-record': '🔗',
      };
      const emoji = types[s.step.stepDefinition.type] || '▸';
      console.log(`    ${emoji} Step ${i}: ${(s.step.stepDefinition as any).prompt}`);
    });
    console.log('');
    console.log('  ─────────────────────────────────────────────');
    console.log('');
  });
}

main().catch(err => {
  console.error('Failed to start demo:', err);
  process.exit(1);
});
