import type {
  CollectionSchema,
  PendingStepExecution,
  RecordData,
  RecordRef,
  StepUser,
} from '../src';

import { StepType } from '../src';

// -- Schemas --
export const SCHEMAS: Record<string, CollectionSchema> = {
  customers: {
    collectionName: 'customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'id', displayName: 'Id', isRelationship: false },
      { fieldName: 'email', displayName: 'Email', isRelationship: false },
      { fieldName: 'name', displayName: 'Full Name', isRelationship: false },
      { fieldName: 'status', displayName: 'Status', isRelationship: false },
      {
        fieldName: 'order',
        displayName: 'Order',
        isRelationship: true,
        relationType: 'BelongsTo',
        relatedCollectionName: 'orders',
      },
    ],
    actions: [
      {
        name: 'send-welcome-email',
        displayName: 'Send Welcome Email',
        endpoint: '/forest/actions/send-welcome-email',
      },
    ],
  },
  orders: {
    collectionName: 'orders',
    collectionDisplayName: 'Orders',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'id', displayName: 'Id', isRelationship: false },
      { fieldName: 'total', displayName: 'Total', isRelationship: false },
      { fieldName: 'date', displayName: 'Date', isRelationship: false },
    ],
    actions: [],
  },
};

// -- Records --
export const RECORDS: Record<string, RecordData> = {
  customer: {
    collectionName: 'customers',
    recordId: [42],
    values: { id: 42, email: 'john@acme.com', name: 'John Doe', status: 'pending' },
  },
  order: {
    collectionName: 'orders',
    recordId: [99],
    values: { id: 99, total: 150, date: '2026-03-15' },
  },
};

// -- User --
export const USER: StepUser = {
  id: 1,
  email: 'admin@acme.com',
  firstName: 'Admin',
  lastName: 'User',
  team: 'Operations',
  renderingId: 1,
  role: 'admin',
  permissionLevel: 'admin',
  tags: {},
};

const BASE_REF: RecordRef = { collectionName: 'customers', recordId: [42], stepIndex: 0 };

// -- Steps (7 types) --
export const STEPS: Omit<PendingStepExecution, 'previousSteps'>[] = [
  {

    runId: 'run-1',
    stepId: 'step-0',
    stepIndex: 0,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: {
      type: StepType.Condition,
      prompt: 'Is this a VIP customer?',
      options: ['Yes', 'No'],
    },
  },
  {

    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 1,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: { type: StepType.ReadRecord, prompt: 'Read the customer email and name' },
  },
  {

    runId: 'run-1',
    stepId: 'step-2',
    stepIndex: 2,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: { type: StepType.UpdateRecord, prompt: 'Set the customer status to active' },
  },
  {

    runId: 'run-1',
    stepId: 'step-3',
    stepIndex: 3,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: { type: StepType.TriggerAction, prompt: 'Send the welcome email' },
  },
  {

    runId: 'run-1',
    stepId: 'step-4',
    stepIndex: 4,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: {
      type: StepType.LoadRelatedRecord,
      prompt: 'Load the customer order',
      automaticExecution: true,
    },
  },
  {

    runId: 'run-1',
    stepId: 'step-5',
    stepIndex: 5,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: {
      type: StepType.Mcp,
      prompt: 'Search for related info about this customer',
    },
  },
  {

    runId: 'run-1',
    stepId: 'step-6',
    stepIndex: 6,
    baseRecordRef: BASE_REF,
    user: USER,
    stepDefinition: {
      type: StepType.Guidance,
      prompt: 'What notes would you like to add about this customer?',
    },
  },
];

// -- AI responses (per step index) --
// Tool names must match what the executors expect
export const AI_RESPONSES: Record<number, { toolName: string; args: Record<string, unknown> }> = {
  0: {
    toolName: 'select-option',
    args: { option: 'Yes', reasoning: 'Customer has a premium account' },
  },
  1: { toolName: 'read-selected-record-fields', args: { fieldNames: ['Email', 'Full Name'] } },
  2: {
    toolName: 'update-record-field',
    args: { fieldName: 'Status', value: 'active', reasoning: 'Onboarding activation' },
  },
  3: {
    toolName: 'select-action',
    args: { actionName: 'Send Welcome Email', reasoning: 'Standard onboarding' },
  },
  4: {
    toolName: 'select-relation',
    args: { relationName: 'Order', reasoning: 'Load customer order' },
  },
  5: { toolName: 'mock_search', args: { query: 'John Doe customer info' } },
  // Step 6 (guidance) -- no AI, front sends userInput directly
};
