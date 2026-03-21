import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { StepOutcome } from '../types/step-outcome';

import StepExecutionFormatters from './step-execution-formatters';

export default class StepSummaryBuilder {
  static build(
    step: StepDefinition,
    stepOutcome: StepOutcome,
    execution: StepExecutionData | undefined,
  ): string {
    const prompt = step.prompt ?? '(no prompt)';
    const header = `Step "${stepOutcome.stepId}" (index ${stepOutcome.stepIndex}):`;
    const lines = [header, `  Prompt: ${prompt}`];

    if (execution !== undefined) {
      // Try custom formatting — if it fires, it owns the entire output section (no Input: line)
      const customLine = execution.executionResult
        ? StepExecutionFormatters.format(execution)
        : null;

      if (customLine !== null) {
        lines.push(customLine);
      } else {
        if (execution.executionParams !== undefined) {
          lines.push(`  Input: ${JSON.stringify(execution.executionParams)}`);
        } else if ('pendingData' in execution && execution.pendingData !== undefined) {
          lines.push(`  Pending: ${JSON.stringify(execution.pendingData)}`);
        }

        if (execution.executionResult) {
          lines.push(`  Output: ${JSON.stringify(execution.executionResult)}`);
        }
      }
    } else {
      const { stepId, stepIndex, type, ...historyDetails } = stepOutcome;
      lines.push(`  History: ${JSON.stringify(historyDetails)}`);
    }

    return lines.join('\n');
  }
}
