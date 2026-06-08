import type ActivityLog from '../executors/activity-log';
import type AgentWithLog from '../executors/agent-with-log';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
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
  readonly agent: AgentWithLog;
  readonly activityLog: ActivityLog;
  readonly runStore: RunStore;
  readonly user: StepUser;
  readonly schemaResolver: SchemaResolver;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly logger: Logger;
  readonly incomingPendingData?: unknown;
  readonly stepTimeoutMs?: number;
  readonly aiInvokeTimeoutMs?: number;
}
