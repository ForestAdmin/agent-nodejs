import type { StepOutcome } from '../../src/types/validated/step-outcome';

import toUpdateStepRequest from '../../src/adapters/step-outcome-to-update-step-mapper';

describe('toUpdateStepRequest', () => {
  it('maps a condition success outcome with selectedOption', () => {
    const outcome: StepOutcome = {
      type: 'condition',
      stepId: 'step-1',
      stepIndex: 2,
      status: 'success',
      selectedOption: 'optionA',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body).toEqual({
      runId: 42,
      stepUpdate: {
        stepIndex: 2,
        attributes: {
          done: true,
          context: { status: 'success', selectedOption: 'optionA' },
        },
      },
      executionStatus: { type: 'success' },
    });
  });

  it('maps a condition error outcome with an error message', () => {
    const outcome: StepOutcome = {
      type: 'condition',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'error',
      error: 'AI gateway unreachable',
    };

    const body = toUpdateStepRequest('7', outcome);

    expect(body).toEqual({
      runId: 7,
      stepUpdate: {
        stepIndex: 0,
        attributes: {
          done: true,
          context: { status: 'error', error: 'AI gateway unreachable' },
        },
      },
      executionStatus: { type: 'error', message: 'AI gateway unreachable' },
    });
  });

  it('falls back to "Unknown error" when an error outcome has no error message', () => {
    const outcome: StepOutcome = {
      type: 'condition',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'error',
    };

    const body = toUpdateStepRequest('7', outcome);

    expect(body.executionStatus).toEqual({ type: 'error', message: 'Unknown error' });
    expect(body.stepUpdate.attributes.context).toEqual({ status: 'error' });
  });

  it('falls back to "Unknown error" when an error outcome has an empty string message', () => {
    const outcome: StepOutcome = {
      type: 'condition',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'error',
      error: '',
    };

    const body = toUpdateStepRequest('7', outcome);

    expect(body.executionStatus).toEqual({ type: 'error', message: 'Unknown error' });
  });

  it('maps a record awaiting-input outcome (done=false, no selectedOption)', () => {
    const outcome: StepOutcome = {
      type: 'record',
      stepId: 'step-1',
      stepIndex: 3,
      status: 'awaiting-input',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body).toEqual({
      runId: 42,
      stepUpdate: {
        stepIndex: 3,
        attributes: {
          done: false,
          context: { status: 'awaiting-input' },
        },
      },
      executionStatus: { type: 'awaiting-input' },
    });
  });

  it('maps a record success outcome (done=true, no selectedOption in context)', () => {
    const outcome: StepOutcome = {
      type: 'record',
      stepId: 'step-1',
      stepIndex: 1,
      status: 'success',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body.stepUpdate.attributes).toEqual({
      done: true,
      context: { status: 'success' },
    });
    expect(body.executionStatus).toEqual({ type: 'success' });
  });

  it('maps an mcp awaiting-input outcome like a record', () => {
    const outcome: StepOutcome = {
      type: 'mcp',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'awaiting-input',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body.stepUpdate.attributes).toEqual({
      done: false,
      context: { status: 'awaiting-input' },
    });
    expect(body.executionStatus).toEqual({ type: 'awaiting-input' });
  });

  it('maps a guidance success outcome (done=true)', () => {
    const outcome: StepOutcome = {
      type: 'guidance',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'success',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body.stepUpdate.attributes).toEqual({
      done: true,
      context: { status: 'success' },
    });
    expect(body.executionStatus).toEqual({ type: 'success' });
  });

  it('converts the runId string to a number', () => {
    const outcome: StepOutcome = {
      type: 'guidance',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'success',
    };

    const body = toUpdateStepRequest('1337', outcome);

    expect(body.runId).toBe(1337);
    expect(typeof body.runId).toBe('number');
  });

  it('preserves stepIndex in the stepUpdate', () => {
    const outcome: StepOutcome = {
      type: 'record',
      stepId: 'step-1',
      stepIndex: 7,
      status: 'success',
    };

    const body = toUpdateStepRequest('42', outcome);

    expect(body.stepUpdate.stepIndex).toBe(7);
  });
});
