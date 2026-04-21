/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution, StepUser } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

export type { McpConfiguration };

/**
 * Info about a run that could not be mapped to a PendingStepExecution.
 * Emitted by the port; the caller (Runner) decides how to react.
 */
export interface MalformedRunInfo {
  runId: string;
  /** null if workflowHistory has no identifiable pending step (edge case). */
  stepId: string | null;
  stepIndex: number | null;
  /** User-safe message destined for the Forest Admin UI / audit trail. */
  userMessage: string;
  /** Technical message for ops logs. */
  technicalMessage: string;
}

/**
 * A pending run dispatched to the executor. Carries the domain step + the
 * adapter-level metadata (e.g. auth token for Forest Admin activity logs)
 * separately so the domain types don't leak secrets.
 */
export interface PendingRunDispatch {
  step: PendingStepExecution;
  auth: { forestServerToken: string };
}

export interface PendingRunsBatch {
  pending: PendingRunDispatch[];
  malformed: MalformedRunInfo[];
}

export interface WorkflowPort {
  /** Returns pending runs + runs that failed to map (to be reported by the caller). */
  getPendingStepExecutions(): Promise<PendingRunsBatch>;
  /** Throws `MalformedRunError` on mapping failure. */
  getPendingStepExecutionsForRun(runId: string): Promise<PendingRunDispatch | null>;
  updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void>;
  getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
  hasRunAccess(runId: string, user: StepUser): Promise<boolean>;
}
