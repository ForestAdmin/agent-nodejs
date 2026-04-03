/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';
import type SchemaCache from '../schema-cache';
import type { StepDefinition } from './step-definition';
import type { StepOutcome } from './step-outcome';
import type { AgentPort } from '../ports/agent-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type { BaseChatModel } from '@forestadmin/ai-proxy';

export interface StepUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  permissionLevel: string;
  tags: Record<string, string>;
}

export interface Step {
  stepDefinition: StepDefinition;
  stepOutcome: StepOutcome;
}

export interface PendingStepExecution {
  readonly envId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly baseRecordRef: RecordRef;
  readonly stepDefinition: StepDefinition;
  readonly previousSteps: ReadonlyArray<Step>;
  readonly user: StepUser;
}

export interface StepExecutionResult {
  stepOutcome: StepOutcome;
}

export interface IStepExecutor {
  execute(): Promise<StepExecutionResult>;
}

export interface ExecutionContext<TStep extends StepDefinition = StepDefinition> {
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly baseRecordRef: RecordRef;
  readonly stepDefinition: TStep;
  readonly model: BaseChatModel;
  readonly agentPort: AgentPort;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly user: StepUser;
  readonly schemaCache: SchemaCache;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly logger: Logger;
  readonly incomingPendingData?: unknown;
}
