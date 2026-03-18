/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution } from '../types/execution';
import type { CollectionRef } from '../types/record';
import type { StepHistory } from '../types/step-history';

/** Placeholder -- will be typed as McpConfiguration from @forestadmin/ai-proxy/mcp-client once added as dependency. */
export type McpConfiguration = unknown;

export interface WorkflowPort {
  getPendingStepExecutions(): Promise<PendingStepExecution[]>;
  updateStepExecution(runId: string, stepHistory: StepHistory): Promise<void>;
  getCollectionRef(collectionName: string): Promise<CollectionRef>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
}
