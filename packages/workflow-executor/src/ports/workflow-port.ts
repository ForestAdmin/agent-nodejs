/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution, StepUser } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

export type { McpConfiguration };

export interface WorkflowPort {
  getPendingStepExecutions(): Promise<PendingStepExecution[]>;
  getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null>;
  updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void>;
  getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
  hasRunAccess(runId: string, user: StepUser): Promise<boolean>;
}
