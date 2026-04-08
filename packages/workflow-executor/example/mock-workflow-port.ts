import type { WorkflowPort } from '../src/ports/workflow-port';
import type { PendingStepExecution, Step, StepUser } from '../src/types/execution';
import type { StepOutcome } from '../src/types/step-outcome';

import { SCHEMAS, STEPS } from './scenario';

export default class MockWorkflowPort implements WorkflowPort {
  currentStepIndex = 0;
  private completedSteps: Step[] = [];

  async getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    if (this.currentStepIndex >= STEPS.length) return [];

    return [this.getCurrentStep()];
  }

  async getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    if (runId !== 'run-1' || this.currentStepIndex >= STEPS.length) return null;

    return this.getCurrentStep();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateStepExecution(_runId: string, outcome: StepOutcome): Promise<void> {
    const step = STEPS[this.currentStepIndex];

    // eslint-disable-next-line no-console
    console.log(
      `  [orchestrator] Step ${outcome.stepIndex} (${step?.stepDefinition.type}): ${outcome.status}`,
    );

    if (outcome.status === 'success') {
      this.completedSteps.push({
        stepDefinition: step.stepDefinition,
        stepOutcome: outcome,
      });
      this.currentStepIndex += 1;

      if (this.currentStepIndex >= STEPS.length) {
        // eslint-disable-next-line no-console
        console.log('\n  Workflow completed!\n');
      }
    } else if (outcome.status === 'awaiting-input') {
      // eslint-disable-next-line no-console
      console.log('  Waiting for frontend trigger...');
    } else if (outcome.status === 'error') {
      // eslint-disable-next-line no-console
      console.log(`  Error: ${outcome.error}`);
    }
  }

  async getCollectionSchema(collectionName: string) {
    const schema = SCHEMAS[collectionName];
    if (!schema) throw new Error(`Unknown collection: ${collectionName}`);

    return schema;
  }

  async getMcpServerConfigs() {
    // Return a dummy config so the Runner calls loadRemoteTools on the mock AiModelPort
    return [{ configs: { 'mock-server': { type: 'http' as const, url: 'http://mock' } } }];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async hasRunAccess(_runId: string, _user: StepUser) {
    return true;
  }

  private getCurrentStep(): PendingStepExecution {
    const step = STEPS[this.currentStepIndex];

    return { ...step, previousSteps: [...this.completedSteps] };
  }
}
