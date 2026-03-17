import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { StepHistory } from '../types/step-history';

export default function buildAdditionalContext(
  history: ReadonlyArray<{ step: StepDefinition; stepHistory: StepHistory }>,
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
