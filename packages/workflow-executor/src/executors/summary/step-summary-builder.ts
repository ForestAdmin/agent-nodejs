import type { StepExecutionData, StepIteration } from '../../types/step-execution-data';
import type { StepDefinition } from '../../types/validated/step-definition';
import type { StepOutcome } from '../../types/validated/step-outcome';

import StepExecutionFormatters from './step-execution-formatters';
import { isPerRecordExecution } from '../../types/step-execution-data';

function summarizeIteration(iteration: StepIteration): string {
  const { collectionName, recordId } = iteration.sourceRecordRef;
  let outcome = 'not run';

  if (iteration.error !== undefined) outcome = `failed: ${iteration.error}`;
  else if (iteration.executionResult !== undefined) {
    outcome = JSON.stringify(iteration.executionResult);
  } else if (iteration.pendingData !== undefined) {
    outcome = `awaiting input: ${JSON.stringify(iteration.pendingData)}`;
  }

  return `  - ${collectionName} #${recordId.join(', ')}: ${outcome}`;
}

export default class StepSummaryBuilder {
  static build(
    step: StepDefinition,
    stepOutcome: StepOutcome,
    execution: StepExecutionData | undefined,
  ): string {
    const prompt = step.prompt ?? '(no prompt)';
    const header = `Step "${stepOutcome.stepId}" (index ${stepOutcome.stepIndex}):`;
    const lines = [header, `  Prompt: ${prompt}`];

    if (isPerRecordExecution(execution)) {
      return [...lines, '  Ran once per record:', ...execution.iterations.map(summarizeIteration)].join(
        '\n',
      );
    }

    if (execution !== undefined) {
      const mcpCalls = StepExecutionFormatters.formatMcpCallsWithoutAnswer(execution);

      if (mcpCalls !== null) {
        lines.push(mcpCalls);

        if (stepOutcome.status === 'success' && execution.executionResult === undefined) {
          lines.push(
            `  Note: the user handled this step manually — the actual outcome may differ from the calls above.`,
          );
        }

        return lines.join('\n');
      }

      // Detect "handled manually": executor proposed an action (pendingData) but the user
      // completed the step on the frontend without going through the trigger endpoint, so the
      // executor never wrote executionResult. Normal completions (confirmation flow, skip, Branch B)
      // always set executionResult before the step is marked done.
      if (
        stepOutcome.status === 'success' &&
        'pendingData' in execution &&
        execution.pendingData !== undefined &&
        execution.executionResult === undefined
      ) {
        lines.push(`  Proposed: ${JSON.stringify(execution.pendingData)}`);
        lines.push(
          `  Note: the user handled this step manually — the actual outcome may differ from the proposal above.`,
        );

        return lines.join('\n');
      }

      // Try custom formatting — if it fires, it owns the entire output section (no Input: line)
      const customLine = execution.executionResult
        ? StepExecutionFormatters.format(execution)
        : null;

      if (customLine !== null) {
        lines.push(customLine);
      } else {
        if ('executionParams' in execution && execution.executionParams !== undefined) {
          lines.push(`  Input: ${JSON.stringify(execution.executionParams)}`);
        } else if ('pendingData' in execution && execution.pendingData !== undefined) {
          lines.push(`  Pending: ${JSON.stringify(execution.pendingData)}`);
        }

        if (execution.executionResult) {
          lines.push(`  Output: ${JSON.stringify(execution.executionResult)}`);
        }
      }
    } else {
      // The classification addresses the operator and the UI, not the model: `error` already carries
      // the only fact that constrains a later step, and naming a culprit cannot change what it writes.
      const { stepId, stepIndex, type, errorKind, errorSourceStepIndex, ...historyDetails } =
        stepOutcome;
      lines.push(`  History: ${JSON.stringify(historyDetails)}`);
    }

    return lines.join('\n');
  }
}
