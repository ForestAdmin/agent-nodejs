import { StepType } from '../../src/types/validated/step-definition';
import {
  ConditionStepOutcomeSchema,
  ErrorKindSchema,
  GuidanceStepOutcomeSchema,
  McpStepOutcomeSchema,
  RecordStepOutcomeSchema,
  stepTypeToOutcomeType,
} from '../../src/types/validated/step-outcome';

describe('stepTypeToOutcomeType', () => {
  it('maps Condition to condition', () => {
    expect(stepTypeToOutcomeType(StepType.Condition)).toBe('condition');
  });

  it('maps McpTask to mcp', () => {
    expect(stepTypeToOutcomeType(StepType.Mcp)).toBe('mcp');
  });

  it('maps ReadRecord to record', () => {
    expect(stepTypeToOutcomeType(StepType.ReadRecord)).toBe('record');
  });

  it('maps UpdateRecord to record', () => {
    expect(stepTypeToOutcomeType(StepType.UpdateRecord)).toBe('record');
  });

  it('maps TriggerAction to record', () => {
    expect(stepTypeToOutcomeType(StepType.TriggerAction)).toBe('record');
  });

  it('maps LoadRelatedRecord to record', () => {
    expect(stepTypeToOutcomeType(StepType.LoadRelatedRecord)).toBe('record');
  });

  it('maps Guidance to guidance', () => {
    expect(stepTypeToOutcomeType(StepType.Guidance)).toBe('guidance');
  });

  it('falls through to record for an unknown future step type', () => {
    expect(stepTypeToOutcomeType('future-step-type' as StepType)).toBe('record');
  });
});

describe('McpStepOutcomeSchema — awaitingInputReason', () => {
  const base = { type: 'mcp' as const, stepId: 'step-1', stepIndex: 0 };

  it("accepts an awaiting-input outcome carrying awaitingInputReason 'needs-oauth-reauth'", () => {
    const parsed = McpStepOutcomeSchema.parse({
      ...base,
      status: 'awaiting-input',
      awaitingInputReason: 'needs-oauth-reauth',
    });

    expect(parsed.awaitingInputReason).toBe('needs-oauth-reauth');
  });

  it('allows awaitingInputReason to be omitted', () => {
    const parsed = McpStepOutcomeSchema.parse({ ...base, status: 'awaiting-input' });

    expect(parsed.awaitingInputReason).toBeUndefined();
  });

  it('rejects an unknown awaitingInputReason value', () => {
    expect(() =>
      McpStepOutcomeSchema.parse({
        ...base,
        status: 'awaiting-input',
        awaitingInputReason: 'nope',
      }),
    ).toThrow();
  });

  it("rejects the legacy 'reason' key under the strict schema", () => {
    expect(() =>
      McpStepOutcomeSchema.parse({
        ...base,
        status: 'awaiting-input',
        reason: 'needs-oauth-reauth',
      }),
    ).toThrow();
  });
});

describe('ErrorKindSchema', () => {
  // All three kinds cross the wire even though only 'operator' drives a UI branch — the vocabulary
  // is a cross-service contract, so it is pinned here rather than by server-side validation.
  it('accepts the three kinds of the classification vocabulary', () => {
    expect(ErrorKindSchema.parse('operator')).toBe('operator');
    expect(ErrorKindSchema.parse('configuration')).toBe('configuration');
    expect(ErrorKindSchema.parse('system')).toBe('system');
  });

  it('rejects a kind outside the vocabulary', () => {
    expect(() => ErrorKindSchema.parse('catastrophic')).toThrow();
  });
});

describe('errorKind on step outcomes', () => {
  const errored = { stepId: 'step-1', stepIndex: 0, status: 'error' as const, error: 'boom' };

  // errorKind joins baseOutcomeFields, so a consumer reads the same key whatever the step type was.
  it('is accepted on every outcome type', () => {
    expect(
      RecordStepOutcomeSchema.parse({ ...errored, type: 'record', errorKind: 'operator' })
        .errorKind,
    ).toBe('operator');
    expect(
      ConditionStepOutcomeSchema.parse({
        ...errored,
        type: 'condition',
        errorKind: 'configuration',
      }).errorKind,
    ).toBe('configuration');
    expect(
      McpStepOutcomeSchema.parse({ ...errored, type: 'mcp', errorKind: 'system' }).errorKind,
    ).toBe('system');
    expect(
      GuidanceStepOutcomeSchema.parse({ ...errored, type: 'guidance', errorKind: 'operator' })
        .errorKind,
    ).toBe('operator');
  });

  it('is absent from an unclassified error outcome', () => {
    const parsed = RecordStepOutcomeSchema.parse({ ...errored, type: 'record' });

    expect(parsed.errorKind).toBeUndefined();
  });

  it('rejects an unknown kind on an outcome', () => {
    expect(() =>
      RecordStepOutcomeSchema.parse({ ...errored, type: 'record', errorKind: 'user' }),
    ).toThrow();
  });
});

describe('errorSourceStepIndex on step outcomes', () => {
  const errored = { stepId: 'step-1', stepIndex: 3, status: 'error' as const, error: 'boom' };

  it('carries the index of the step the error is about', () => {
    const parsed = RecordStepOutcomeSchema.parse({
      ...errored,
      type: 'record',
      errorSourceStepIndex: 1,
    });

    expect(parsed.errorSourceStepIndex).toBe(1);
  });

  // The first step of a run is index 0, so the floor has to be inclusive.
  it('accepts the first step of a run', () => {
    const parsed = RecordStepOutcomeSchema.parse({
      ...errored,
      type: 'record',
      errorSourceStepIndex: 0,
    });

    expect(parsed.errorSourceStepIndex).toBe(0);
  });

  it('is absent when the error names no source step', () => {
    const parsed = RecordStepOutcomeSchema.parse({ ...errored, type: 'record' });

    expect(parsed.errorSourceStepIndex).toBeUndefined();
  });

  it.each([-1, 1.5, '2'])('rejects %p as a step index', badIndex => {
    expect(() =>
      RecordStepOutcomeSchema.parse({
        ...errored,
        type: 'record',
        errorSourceStepIndex: badIndex,
      }),
    ).toThrow();
  });
});
