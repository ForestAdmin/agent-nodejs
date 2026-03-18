/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { PendingStepExecution } from '../types/execution';
import type { RecordRef } from '../types/record';
import type { StepHistory } from '../types/step-history';

/** Placeholder -- will be typed as McpConfiguration from @forestadmin/ai-proxy/mcp-client once added as dependency. */
export type McpConfiguration = unknown;

export interface WorkflowPort {
  getPendingStepExecutions(): Promise<PendingStepExecution[]>;
  completeStepExecution(runId: string, stepHistory: StepHistory): Promise<void>;
  getCollectionRef(collectionName: string): Promise<RecordRef>;
  getMcpServerConfigs(): Promise<McpConfiguration[]>;
}
