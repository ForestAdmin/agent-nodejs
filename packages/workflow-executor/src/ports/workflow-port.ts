import type { AvailableStepExecution } from '../types/execution-context';
import type { CollectionSchema } from '../types/validated/collection';
import type { StepOutcome } from '../types/validated/step-outcome';
import type { ToolConfig } from '@forestadmin/ai-proxy';

export interface MalformedRunInfo {
  runId: string;
  // null when workflowHistory has no identifiable available step.
  stepId: string | null;
  stepIndex: number | null;
  // userMessage surfaces in the Forest Admin UI / audit trail; technicalMessage in ops logs.
  userMessage: string;
  technicalMessage: string;
}

// step = domain payload, auth = adapter metadata. Split so secrets don't leak into the domain.
export interface AvailableRunDispatch {
  step: AvailableStepExecution;
  auth: { forestServerToken: string };
}

export interface AvailableRunsBatch {
  pending: AvailableRunDispatch[];
  malformed: MalformedRunInfo[];
}

export interface WorkflowPort {
  getAvailableRuns(): Promise<AvailableRunsBatch>;
  // Throws MalformedRunError on mapping failure.
  getAvailableRun(runId: string): Promise<AvailableRunDispatch | null>;
  // Returns the next step to chain when the orchestrator has one ready, or null when the run is
  // awaiting-input / finished / errored. Lets the executor skip a poll cycle for auto workflows.
  updateStepExecution(
    runId: string,
    stepOutcome: StepOutcome,
  ): Promise<AvailableRunDispatch | null>;
  getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema>;
  getMcpServerConfigs(): Promise<Record<string, ToolConfig>>;
  // Pushes the running executor's version to the orchestrator (last-write-wins, stored per env).
  reportExecutorVersion(version: string): Promise<void>;
  // Only the user id is needed (the access check is `?userId=`); kept narrow so callers don't
  // have to produce a full StepUser.
  hasRunAccess(runId: string, user: { id: number }): Promise<boolean>;
}
