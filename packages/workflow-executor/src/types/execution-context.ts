import type AgentWithLog from '../executors/agent-with-log';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type SchemaResolver from '../schema-resolver';
import type { RecordRef } from './validated/collection';
import type {
  ApprovalRequestReview,
  AvailableStepExecution,
  CallScope,
  Step,
  StepUser,
  SubWorkflowEnd,
} from './validated/execution';
import type { StepDefinition } from './validated/step-definition';
import type { StepOutcome } from './validated/step-outcome';
import type { ActivityLogConfig } from '@forestadmin/agent-client';
import type { BaseChatModel } from '@forestadmin/ai-proxy';

// Re-export the runtime result types alongside the context they flow with.
export type { AvailableStepExecution, CallScope, Step, StepUser, SubWorkflowEnd };

export interface StepExecutionResult {
  stepOutcome: StepOutcome;
  // Set when a step running once per record stopped before its next record: 'stopped' when the run
  // was aborted or its lock lost (nothing to report), 'yielded' when the runtime hands it back.
  interrupted?: 'stopped' | 'yielded';
}

// Asked before each record of a step running once per record.
export interface RunControl {
  beforeRecord(): Promise<'continue' | 'stop' | 'yield'>;
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
  readonly activityLog: ActivityLogConfig;
  readonly runStore: RunStore;
  readonly user: StepUser;
  readonly timezone: string;
  readonly schemaResolver: SchemaResolver;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly logger: Logger;
  // Set only while the step runs inside a Sub-workflow call.
  readonly callScope?: CallScope;
  readonly approvalRequests?: ReadonlyArray<ApprovalRequestReview>;
  readonly subWorkflowEnds?: ReadonlyArray<Readonly<SubWorkflowEnd>>;
  readonly incomingPendingData?: unknown;
  readonly stepTimeoutS?: number;
  readonly aiInvokeTimeoutS?: number;
  readonly runControl?: RunControl;
  // Set on one record's run of a step running once per record: names that record to the AI.
  readonly perRecordLabel?: string;
}
