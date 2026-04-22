/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution, StepUser } from '../types/execution-context';
import type { CollectionSchema } from '../types/validated/collection';
import type { StepOutcome } from '../types/validated/step-outcome';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

export type { McpConfiguration };

export interface MalformedRunInfo {
  runId: string;
  // null when workflowHistory has no identifiable pending step.
  stepId: string | null;
  stepIndex: number | null;
  // userMessage surfaces in the Forest Admin UI / audit trail; technicalMessage in ops logs.
  userMessage: string;
  technicalMessage: string;
}

// step = domain payload, auth = adapter metadata. Split so secrets don't leak into the domain.
export interface PendingRunDispatch {
  step: PendingStepExecution;
  auth: { forestServerToken: string };
}

export interface PendingRunsBatch {
  pending: PendingRunDispatch[];
  malformed: MalformedRunInfo[];
}

export interface WorkflowPort {
  getPendingStepExecutions(): Promise<PendingRunsBatch>;
  // Throws MalformedRunError on mapping failure.
  getPendingStepExecutionsForRun(runId: string): Promise<PendingRunDispatch | null>;
  updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void>;
  getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
  hasRunAccess(runId: string, user: StepUser): Promise<boolean>;
}
