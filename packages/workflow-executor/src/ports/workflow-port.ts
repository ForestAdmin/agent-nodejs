/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';

/** Placeholder -- will be typed as McpConfiguration from @forestadmin/ai-proxy/mcp-client once added as dependency. */
export type McpConfiguration = unknown;

export interface WorkflowPort {
  getPendingStepExecutions(): Promise<PendingStepExecution[]>;
  updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void>;
  getCollectionSchema(collectionName: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
}
