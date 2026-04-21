import type { RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';

import { RunStorePortError, WorkflowExecutorError } from '../errors';

export default class InMemoryStore implements RunStore {
  private readonly data = new Map<string, Map<number, StepExecutionData>>();

  async init(): Promise<void> {
    return this.callPort('init', async () => {
      // No-op: in-memory store requires no initialization
    });
  }

  async close(): Promise<void> {
    return this.callPort('close', async () => {
      // No-op: nothing to clean up
    });
  }

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.callPort('getStepExecutions', async () => {
      const runData = this.data.get(runId);

      if (!runData) return [];

      return [...runData.values()].sort((a, b) => a.stepIndex - b.stepIndex);
    });
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    return this.callPort('saveStepExecution', async () => {
      let runData = this.data.get(runId);

      if (!runData) {
        runData = new Map();
        this.data.set(runId, runData);
      }

      runData.set(stepExecution.stepIndex, stepExecution);
    });
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new RunStorePortError(operation, cause);
    }
  }
}
