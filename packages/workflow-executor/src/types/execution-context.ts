/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type AgentWithLog from '../executors/agent-with-log';
import type { ActivityLogPort } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaResolver from '../schema-resolver';
import type { RecordRef } from './validated/collection';
import type { AvailableStepExecution, Step, StepUser } from './validated/execution';
import type { StepDefinition } from './validated/step-definition';
import type { StepOutcome } from './validated/step-outcome';
import type { BaseChatModel } from '@forestadmin/ai-proxy';

// Re-export the runtime result types alongside the context they flow with.
export type { AvailableStepExecution, Step, StepUser };

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
  // Audited data access — every call emits an activity-log entry. Built by the factory off
  // agentPort + activityLogPort + schemaResolver, so executors share one wiring point.
  readonly agent: AgentWithLog;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly user: StepUser;
  readonly schemaResolver: SchemaResolver;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly logger: Logger;
  readonly incomingPendingData?: unknown;
  readonly stepTimeoutMs?: number;
  readonly aiInvokeTimeoutMs?: number;
  readonly activityLogPort: ActivityLogPort;
}
