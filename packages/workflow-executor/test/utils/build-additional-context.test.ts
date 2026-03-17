import type { StepDefinition } from '../../src/types/step-definition';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { StepHistory } from '../../src/types/step-history';

import { StepType } from '../../src/types/step-definition';
import buildAdditionalContext from '../../src/utils/build-additional-context';

function makeHistoryEntry(
  overrides: { stepId?: string; stepIndex?: number; prompt?: string } = {},
): { step: StepDefinition; stepHistory: StepHistory } {
  return {
    step: {
      id: overrides.stepId ?? 'step-1',
      type: StepType.Condition,
      options: ['A', 'B'],
      prompt: overrides.prompt ?? 'Pick one',
    },
    stepHistory: {
      type: 'condition',
      stepId: overrides.stepId ?? 'step-1',
      stepIndex: overrides.stepIndex ?? 0,
      status: 'success',
    },
  };
}

describe('buildAdditionalContext', () => {
  it('returns empty string for empty history', () => {
    expect(buildAdditionalContext([], [])).toBe('');
  });

  it('includes prompt and result from previous steps', () => {
    const history = [makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Approve?' })];
    const executions: StepExecutionData[] = [
      { type: 'condition', stepIndex: 0, executionResult: { answer: 'Yes' } },
    ];

    const result = buildAdditionalContext(history, executions);

    expect(result).toContain('Step "cond-1"');
    expect(result).toContain('Prompt: Approve?');
    expect(result).toContain('"answer":"Yes"');
  });

  it('skips steps without executionResult', () => {
    const history = [
      makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0 }),
      makeHistoryEntry({ stepId: 'cond-2', stepIndex: 1, prompt: 'Second?' }),
    ];
    const executions: StepExecutionData[] = [
      { type: 'condition', stepIndex: 0 },
      { type: 'condition', stepIndex: 1, executionResult: { answer: 'No' } },
    ];

    const result = buildAdditionalContext(history, executions);

    expect(result).not.toContain('cond-1');
    expect(result).toContain('cond-2');
    expect(result).toContain('"answer":"No"');
  });

  it('shows "(no prompt)" when step has no prompt', () => {
    const entry = makeHistoryEntry({ stepIndex: 0 });
    entry.step.prompt = undefined;
    const executions: StepExecutionData[] = [
      { type: 'condition', stepIndex: 0, executionResult: { answer: 'A' } },
    ];

    const result = buildAdditionalContext([entry], executions);

    expect(result).toContain('Prompt: (no prompt)');
  });
});
