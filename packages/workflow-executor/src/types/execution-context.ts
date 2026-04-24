/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActivityLogPort } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaCache from '../schema-cache';
import type { RecordRef } from './validated/collection';
import type { PendingStepExecution, Step, StepUser } from './validated/execution';
import type { StepDefinition } from './validated/step-definition';
import type { StepOutcome } from './validated/step-outcome';
import type { BaseChatModel } from '@forestadmin/ai-proxy';

// Re-export the runtime result types alongside the context they flow with.
export type { PendingStepExecution, Step, StepUser };

export interface StepExecutionResult {
  stepOutcome: StepOutcome;
}

export interface IStepExecutor {
  execute(): Promise<StepExecutionResult>;
}

// ExecutionContext holds port instances (with methods) — not zod-validatable.
export interface ExecutionContext<TStep extends StepDefinition = StepDefinition> {
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly collectionId: string;
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
  readonly stepTimeoutMs?: number;
  readonly activityLogPort: ActivityLogPort;
}
