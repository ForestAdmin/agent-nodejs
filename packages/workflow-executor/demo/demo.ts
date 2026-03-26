/* eslint-disable no-console */

import type { WorkflowPort } from '../src/ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../src/types/execution';
import type { CollectionSchema } from '../src/types/record';
import type { StepOutcome } from '../src/types/step-outcome';
import type { AiClient, BaseChatModel, RemoteTool } from '@forestadmin/ai-proxy';

import fs from 'fs';
import http from 'http';
import path from 'path';

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

const DEMO_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGZvcmVzdGFkbWluLmNvbSIsImlhdCI6MTc3NDUzNDAzOCwiZXhwIjoxODA2MDcwMDM4fQ.CZAHRCr2Jj1hIdE3rCFRadnOMjA9NyS64aZEao0oHv0';

const USER: StepUser = {
  id: 1, email: 'demo@forestadmin.com', firstName: 'Demo', lastName: 'User',
  team: 'Product', renderingId: 1, role: 'admin', permissionLevel: 'admin', tags: {},
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CUSTOMERS_SCHEMA: CollectionSchema = {
  collectionName: 'customers', collectionDisplayName: 'Customers', primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'email', displayName: 'Email', isRelationship: false },
    { fieldName: 'name', displayName: 'Full Name', isRelationship: false },
    { fieldName: 'company', displayName: 'Company', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
    { fieldName: 'orders', displayName: 'Orders', isRelationship: true, relationType: 'HasMany', relatedCollectionName: 'orders' },
  ],
  actions: [{ name: 'send_welcome_email', displayName: 'Send Welcome Email', endpoint: '/forest/actions/send-welcome-email' }],
};

const ORDERS_SCHEMA: CollectionSchema = {
  collectionName: 'orders', collectionDisplayName: 'Orders', primaryKeyFields: ['id'],
  fields: [
    { fieldName: 'id', displayName: 'Id', isRelationship: false },
    { fieldName: 'reference', displayName: 'Reference', isRelationship: false },
    { fieldName: 'total', displayName: 'Total', isRelationship: false },
    { fieldName: 'status', displayName: 'Status', isRelationship: false },
    { fieldName: 'shipping_status', displayName: 'Shipping Status', isRelationship: false },
  ],
  actions: [
    { name: 'mark_shipped', displayName: 'Mark as Shipped', endpoint: '/forest/actions/mark-shipped' },
    { name: 'send_invoice', displayName: 'Send Invoice', endpoint: '/forest/actions/send-invoice' },
  ],
};

// ---------------------------------------------------------------------------
// Workflow definitions
// ---------------------------------------------------------------------------

interface WfStepDef {
  step: Omit<PendingStepExecution, 'previousSteps'>;
  aiResponses: Array<{ name: string; args: Record<string, unknown> }>;
}

// Workflow 1: Customer Onboarding (5 steps)
const WF1_STEPS: WfStepDef[] = [
  { step: { runId: 'run-1', stepId: 's1-0', stepIndex: 0, baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 }, stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer name, email, and company' }, user: USER },
    aiResponses: [{ name: 'read-selected-record-fields', args: { fieldNames: ['Full Name', 'Email', 'Company'] } }] },
  { step: { runId: 'run-1', stepId: 's1-1', stepIndex: 1, baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 }, stepDefinition: { type: StepType.Condition, options: ['Yes — CGV accepted', 'No — CGV not accepted'], prompt: 'Has the customer accepted the terms?' }, user: USER },
    aiResponses: [{ name: 'choose-gateway-option', args: { option: 'Yes — CGV accepted', reasoning: 'CGV field is true', question: 'CGV check' } }] },
  { step: { runId: 'run-1', stepId: 's1-2', stepIndex: 2, baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 }, stepDefinition: { type: StepType.UpdateRecord, prompt: 'Activate the customer' }, user: USER },
    aiResponses: [{ name: 'update-record-field', args: { fieldName: 'Status', value: 'active', reasoning: 'Activate after CGV' } }] },
  { step: { runId: 'run-1', stepId: 's1-3', stepIndex: 3, baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 }, stepDefinition: { type: StepType.TriggerAction, prompt: 'Send the welcome email' }, user: USER },
    aiResponses: [{ name: 'select-action', args: { actionName: 'Send Welcome Email', reasoning: 'Welcome new customer' } }] },
  { step: { runId: 'run-1', stepId: 's1-4', stepIndex: 4, baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 }, stepDefinition: { type: StepType.LoadRelatedRecord, prompt: 'Load the first order' }, user: USER },
    aiResponses: [{ name: 'select-relation', args: { relationName: 'Orders', reasoning: 'Load first order' } }] },
];

// Workflow 2: Order Fulfillment (3 steps)
const WF2_STEPS: WfStepDef[] = [
  { step: { runId: 'run-2', stepId: 's2-0', stepIndex: 0, baseRecordRef: { collectionName: 'orders', recordId: [1001], stepIndex: 0 }, stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the order details' }, user: USER },
    aiResponses: [{ name: 'read-selected-record-fields', args: { fieldNames: ['Reference', 'Total', 'Status'] } }] },
  { step: { runId: 'run-2', stepId: 's2-1', stepIndex: 1, baseRecordRef: { collectionName: 'orders', recordId: [1001], stepIndex: 0 }, stepDefinition: { type: StepType.UpdateRecord, prompt: 'Update shipping status to shipped' }, user: USER },
    aiResponses: [{ name: 'update-record-field', args: { fieldName: 'Shipping Status', value: 'shipped', reasoning: 'Order ready to ship' } }] },
  { step: { runId: 'run-2', stepId: 's2-2', stepIndex: 2, baseRecordRef: { collectionName: 'orders', recordId: [1001], stepIndex: 0 }, stepDefinition: { type: StepType.TriggerAction, prompt: 'Send the invoice' }, user: USER },
    aiResponses: [{ name: 'select-action', args: { actionName: 'Send Invoice', reasoning: 'Invoice for shipped order' } }] },
];

const ALL_WORKFLOWS: Record<string, WfStepDef[]> = { 'run-1': WF1_STEPS, 'run-2': WF2_STEPS };

// ---------------------------------------------------------------------------
// Fake WorkflowPort (multi-run)
// ---------------------------------------------------------------------------

class FakeWorkflowPort implements WorkflowPort {
  private state: Record<string, { idx: number; outcomes: StepOutcome[] }> = {
    'run-1': { idx: 0, outcomes: [] },
    'run-2': { idx: 0, outcomes: [] },
  };

  reset(): void {
    this.state = { 'run-1': { idx: 0, outcomes: [] }, 'run-2': { idx: 0, outcomes: [] } };
    console.log('  🔄 All workflows reset\n');
  }

  getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    const wf = ALL_WORKFLOWS[runId];
    const st = this.state[runId];
    if (!wf || !st || st.idx >= wf.length) return Promise.resolve(null);

    const { step } = wf[st.idx];
    const previousSteps = st.outcomes.map((o, i) => ({ stepDefinition: wf[i].step.stepDefinition, stepOutcome: o }));
    return Promise.resolve({ ...step, previousSteps } as PendingStepExecution);
  }

  async updateStepExecution(runId: string, outcome: StepOutcome): Promise<void> {
    const st = this.state[runId];
    if (!st) return;
    const e = outcome.status === 'success' ? '✅' : outcome.status === 'error' ? '❌' : '⏳';
    console.log(`  ${e} [${runId}] Step ${outcome.stepIndex} → ${outcome.status}`);
    if (outcome.status === 'success' || outcome.status === 'error') {
      st.outcomes.push(outcome);
      st.idx += 1;
      const wf = ALL_WORKFLOWS[runId];
      if (wf && st.idx >= wf.length) console.log(`  🎉 [${runId}] Workflow completed!\n`);
    }
  }

  getCurrentStepIndex(runId: string): number { return this.state[runId]?.idx ?? 0; }

  getPendingStepExecutions(): Promise<PendingStepExecution[]> { return Promise.resolve([]); }
  getCollectionSchema(n: string): Promise<CollectionSchema> { return Promise.resolve(n === 'orders' ? ORDERS_SCHEMA : CUSTOMERS_SCHEMA); }
  getMcpServerConfigs(): Promise<[]> { return Promise.resolve([]); }
  hasRunAccess(): Promise<boolean> { return Promise.resolve(true); }
}

// ---------------------------------------------------------------------------
// Mock AI (multi-run aware)
// ---------------------------------------------------------------------------

function createDemoAiClient(wfPort: FakeWorkflowPort): AiClient & { reset(): void } {
  // Track which run is currently being executed so invoke() returns the right response
  let activeRunId: string | null = null;

  const model = {
    bindTools: () => model,
    invoke: () => {
      // Find the right AI response based on which run is active and its current step
      let resp = { name: 'unknown', args: {} as Record<string, unknown> };

      if (activeRunId) {
        const wf = ALL_WORKFLOWS[activeRunId];
        const idx = wfPort.getCurrentStepIndex(activeRunId);

        if (wf && idx < wf.length) {
          resp = wf[idx].aiResponses[0];
        }
      }

      return new Promise(resolve => {
        setTimeout(() => resolve({ tool_calls: [{ name: resp.name, args: resp.args }] }), 250);
      });
    },
  } as unknown as BaseChatModel;

  return {
    getModel: () => model,
    loadRemoteTools: () => Promise.resolve([] as RemoteTool[]),
    closeConnections: () => Promise.resolve(),
    reset() { activeRunId = null; },
    setActiveRun(runId: string) { activeRunId = runId; },
  } as unknown as AiClient & { reset(): void; setActiveRun(runId: string): void };
}

// ---------------------------------------------------------------------------
// Mock AgentPort
// ---------------------------------------------------------------------------

const agentPort = {
  getRecord: (_q: any, _u: any) => {
    // Return different data based on collection (inferred from first call context)
    return new Promise(resolve => setTimeout(() => resolve({
      collectionName: 'customers', recordId: [42],
      values: { id: 42, email: 'jane.doe@acme.com', name: 'Jane Doe', company: 'Acme Corp', status: 'pending',
        reference: 'ORD-2024-1001', total: 2499.99, shipping_status: 'pending' },
    }), 200));
  },
  updateRecord: (_q: any, _u: any) => {
    console.log('  ✏️  Record updated');
    return new Promise(resolve => setTimeout(() => resolve({
      collectionName: 'orders', recordId: [1001], values: { id: 1001, status: 'active' },
    }), 250));
  },
  getRelatedData: () => {
    console.log('  🔗 Related data loaded');
    return new Promise(resolve => setTimeout(() => resolve([
      { collectionName: 'orders', recordId: [1001], values: { id: 1001, reference: 'ORD-2024-1001', total: 2499.99, status: 'confirmed' } },
    ]), 200));
  },
  executeAction: () => {
    console.log('  📧 Action executed');
    return new Promise(resolve => setTimeout(() => resolve({ success: true }), 300));
  },
};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const workflowPort = new FakeWorkflowPort();
  const runStore = new InMemoryStore();
  const schemaCache = new SchemaCache();
  const aiClient = createDemoAiClient(workflowPort);

  const runner = new Runner({
    agentPort: agentPort as any,
    workflowPort, runStore, schemaCache, aiClient,
    pollingIntervalMs: 60_000, envSecret: ENV_SECRET, authSecret: AUTH_SECRET,
  });

  await runStore.init();

  const { default: ExecutorHttpServer } = await import('../src/http/executor-http-server');
  const executorServer = new ExecutorHttpServer({ port: 0, runner, authSecret: AUTH_SECRET, workflowPort });
  const executorApp = executorServer.callback;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      let html = fs.readFileSync(path.join(__dirname, 'demo.html'), 'utf-8');
      html = html.replace('__DEMO_TOKEN__', DEMO_TOKEN);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    if (req.method === 'POST' && req.url === '/reset') {
      workflowPort.reset();
      (aiClient as any).reset();
      (runStore as any).store = new Map();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reset: true }));
      return;
    }
    // Set active run so AI mock returns the right response
    const triggerMatch = req.method === 'POST' && req.url?.match(/^\/runs\/(run-\d+)\/trigger$/);
    if (triggerMatch) {
      (aiClient as any).setActiveRun(triggerMatch[1]);
    }
    executorApp(req, res);
  });

  server.listen(HTTP_PORT, () => {
    console.log('\n  ╔══════════════════════════════════════════════╗');
    console.log('  ║   🌲 Workflow Executor — Parallel Demo        ║');
    console.log('  ╚══════════════════════════════════════════════╝\n');
    console.log(`  🌐 http://localhost:${HTTP_PORT}\n`);
    console.log('  Workflow 1: Customer Onboarding (5 steps) — run-1');
    console.log('  Workflow 2: Order Fulfillment (3 steps)   — run-2\n');
    console.log('  ─────────────────────────────────────────────\n');
  });
}

main().catch(e => { console.error('Failed:', e); process.exit(1); });
