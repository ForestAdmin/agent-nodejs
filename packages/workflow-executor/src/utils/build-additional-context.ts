import type { StepRecord } from '../types/execution';
import type { StepExecutionData } from '../types/step-execution-data';

export default function buildAdditionalContext(
  history: ReadonlyArray<StepRecord>,
  stepExecutions: StepExecutionData[],
): string {
  return history
    .map(({ step, stepHistory }) => {
      const execution = stepExecutions.find(e => e.stepIndex === stepHistory.stepIndex);
      if (!execution?.executionResult) return null;

      const prompt = step.prompt ?? '(no prompt)';
      const result = JSON.stringify(execution.executionResult);

      return `Step "${step.id}" (index ${stepHistory.stepIndex}):\n  Prompt: ${prompt}\n  Result: ${result}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
