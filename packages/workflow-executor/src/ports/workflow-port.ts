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

export interface PendingRunsBatch {
  pending: PendingStepExecution[];
  malformed: MalformedRunInfo[];
}

export interface WorkflowPort {
  /** Returns pending runs + runs that failed to map (to be reported by the caller). */
  getPendingStepExecutions(): Promise<PendingRunsBatch>;
  /** Throws `MalformedRunError` on mapping failure. */
  getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null>;
  updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void>;
  getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
  hasRunAccess(runId: string, user: StepUser): Promise<boolean>;
}
