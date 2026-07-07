import { StepType } from '../../src/types/validated/step-definition';
import {
  McpStepOutcomeSchema,
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
