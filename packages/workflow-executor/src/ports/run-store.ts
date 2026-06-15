import type { Logger } from './logger-port';
import type { StepExecutionData } from '../types/step-execution-data';

// 'won' = claim acquired, caller owns the side effect; 'executing' = held by another caller;
// 'done' = already completed, caller must replay.
export type ClaimOutcome = 'won' | 'executing' | 'done';

export interface RunStore {
  init(logger?: Logger): Promise<void>;
  close(logger?: Logger): Promise<void>;
  getStepExecutions(runId: string): Promise<StepExecutionData[]>;
  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void>;
  // Atomically set `idempotencyPhase: 'executing'` iff currently unclaimed. Must be atomic against
  // concurrent callers — this is the sole cross-instance dedup.
  claimStepExecution(runId: string, seed: StepExecutionData): Promise<ClaimOutcome>;
}
