import { StepType } from '../../src/types/step-definition';
import { stepTypeToOutcomeType } from '../../src/types/step-outcome';

describe('stepTypeToOutcomeType', () => {
  it('maps Condition to condition', () => {
    expect(stepTypeToOutcomeType(StepType.Condition)).toBe('condition');
  });

  it('maps McpTask to mcp', () => {
    expect(stepTypeToOutcomeType(StepType.McpTask)).toBe('mcp');
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

  it('falls through to record for an unknown future step type', () => {
    expect(stepTypeToOutcomeType('future-step-type' as StepType)).toBe('record');
  });
});
