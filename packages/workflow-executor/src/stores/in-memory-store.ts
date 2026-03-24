import type { RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';

export default class InMemoryStore implements RunStore {
  private readonly data = new Map<string, Map<number, StepExecutionData>>();

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    const runData = this.data.get(runId);

    if (!runData) return [];

    return [...runData.values()].sort((a, b) => a.stepIndex - b.stepIndex);
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    let runData = this.data.get(runId);

    if (!runData) {
      runData = new Map();
      this.data.set(runId, runData);
    }

    runData.set(stepExecution.stepIndex, stepExecution);
  }
}
