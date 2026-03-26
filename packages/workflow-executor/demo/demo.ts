/* eslint-disable no-console */

/**
 * Demo script — starts a workflow executor with a fake orchestrator.
 *
 * Usage:
 *   npx ts-node packages/workflow-executor/demo/demo.ts
 *
 * Then open http://localhost:3100 in a browser.
 * The token is auto-filled.
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AUTH_SECRET = 'demo-auth-secret-for-testing-only';
const ENV_SECRET = 'a'.repeat(64);
const HTTP_PORT = 3100;
const RUN_ID = 'demo-1';

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

const CUSTOMER_SCHEMA: CollectionSchema = {
  collectionName: 'customers',
  collectionDisplayName: 'Customers',
  primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'email', displayName: 'Email', isRelationship: false },
    { fieldName: 'name', displayName: 'Name', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
  ],
  actions: [
    {
      name: 'send_welcome_email',
      displayName: 'Send Welcome Email',
      endpoint: '/forest/actions/send-welcome-email',
    },
  ],
};

// ---------------------------------------------------------------------------
// Workflow definition (3 steps)
// ---------------------------------------------------------------------------

const WORKFLOW_STEPS: Array<{
  step: Omit<PendingStepExecution, 'previousSteps'>;
  aiResponse: { name: string; args: Record<string, unknown> };
}> = [
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-read',
      stepIndex: 0,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: { type: 'read-record', prompt: 'Read the customer email and name' },
      user: DEMO_USER,
    },
    aiResponse: {
      name: 'read-selected-record-fields',
      args: { fieldNames: ['Email', 'Name'] },
    },
  },
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-update',
      stepIndex: 1,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: 'update-record',
        prompt: 'Update the customer status to active',
      },
      user: DEMO_USER,
    },
    aiResponse: {
      name: 'update-record-field',
      args: { fieldName: 'Status', value: 'active', reasoning: 'Customer needs activation' },
    },
  },
  {
    step: {
      runId: RUN_ID,
      stepId: 'step-action',
      stepIndex: 2,
      baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      stepDefinition: {
        type: 'trigger-action',
        prompt: 'Send the welcome email',
      },
      user: DEMO_USER,
    },
    aiResponse: {
      name: 'select-action',
      args: { actionName: 'Send Welcome Email', reasoning: 'New customer needs welcome email' },
    },
  },
];

// ---------------------------------------------------------------------------
// Fake WorkflowPort (in-memory orchestrator)
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
    console.log(
      `  ✓ Step ${outcome.stepIndex} (${outcome.type}) → ${outcome.status}`,
      outcome.error ? `[${outcome.error}]` : '',
    );

    if (outcome.status === 'success' || outcome.status === 'error') {
      this.outcomes.push(outcome);
      this.currentStepIndex += 1;

      if (this.currentStepIndex >= WORKFLOW_STEPS.length) {
        console.log('\n🎉 Workflow completed!');
      } else {
        console.log(`  → Next step: ${WORKFLOW_STEPS[this.currentStepIndex].step.stepId}`);
      }
    }
  }

  getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    return Promise.resolve([]);
  }

  getCollectionSchema(_name: string): Promise<CollectionSchema> {
    return Promise.resolve(CUSTOMER_SCHEMA);
  }

  getMcpServerConfigs(): Promise<never[]> {
    return Promise.resolve([]);
  }

  hasRunAccess(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

// ---------------------------------------------------------------------------
// Mock AI client
// ---------------------------------------------------------------------------

function createDemoAiClient(): AiClient {
  let callCount = 0;

  const model = {
    bindTools: () => model,
    invoke: () => {
      const idx = Math.min(callCount, WORKFLOW_STEPS.length - 1);
      const response = WORKFLOW_STEPS[idx].aiResponse;
      callCount += 1;

      return Promise.resolve({
        tool_calls: [{ name: response.name, args: response.args }],
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
  getRecord: () =>
    Promise.resolve({
      collectionName: 'customers',
      recordId: [42],
      values: { id: 42, email: 'jane.doe@example.com', name: 'Jane Doe', status: 'pending' },
    }),
  updateRecord: () => {
    console.log('  📝 AgentPort: record updated');

    return Promise.resolve({
      collectionName: 'customers',
      recordId: [42],
      values: { id: 42, status: 'active' },
    });
  },
  getRelatedData: () => Promise.resolve([]),
  executeAction: () => {
    console.log('  📧 AgentPort: action executed (welcome email sent)');

    return Promise.resolve({ success: true });
  },
};

// ---------------------------------------------------------------------------
// Start server — serves both the API (via Runner) and the demo HTML
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

  // Generate a demo token
  const token = jsonwebtoken.sign(
    { id: DEMO_USER.id, email: DEMO_USER.email },
    AUTH_SECRET,
    { expiresIn: '24h' },
  );

  // Build the executor Koa app (without starting it on a port)
  const { default: ExecutorHttpServer } = await import('../src/http/executor-http-server');
  const executorServer = new ExecutorHttpServer({
    port: 0,
    runner,
    authSecret: AUTH_SECRET,
    workflowPort,
  });
  const executorApp = executorServer.callback;

  // Create a raw HTTP server that serves:
  // - GET / → demo.html (with token injected)
  // - Everything else → executor Koa app
  const server = http.createServer((req, res) => {
    // Serve the demo page
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const htmlPath = path.join(__dirname, 'demo.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');
      // Inject the token into the input field
      html = html.replace(
        'placeholder="Bearer token (leave empty to auto-generate)"',
        `placeholder="Bearer token" value="${token}"`,
      );

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);

      return;
    }

    // Forward to executor Koa app
    executorApp(req, res);
  });

  server.listen(HTTP_PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       Workflow Executor — Demo Server            ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🌐 Open: http://localhost:${HTTP_PORT}`);
    console.log(`  📋 Run ID: ${RUN_ID}`);
    console.log('');
    console.log('  Workflow steps:');
    WORKFLOW_STEPS.forEach((s, i) => {
      console.log(
        `    ${i}. ${s.step.stepDefinition.type} — "${(s.step.stepDefinition as any).prompt}"`,
      );
    });
    console.log('');
    console.log('  Click "Trigger" to start. Steps 1 & 2 need confirmation.');
    console.log('');
    console.log('─────────────────────────────────────────────────');
    console.log('');
  });
}

main().catch(err => {
  console.error('Failed to start demo:', err);
  process.exit(1);
});
