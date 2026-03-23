import { StepType } from '../../src/types/step-definition';
import { stepTypeToOutcomeType } from '../../src/types/step-outcome';

describe('stepTypeToOutcomeType', () => {
  it('maps Condition to condition', () => {
    expect(stepTypeToOutcomeType(StepType.Condition)).toBe('condition');
  });

  it('maps McpTask to mcp-task', () => {
    expect(stepTypeToOutcomeType(StepType.McpTask)).toBe('mcp-task');
  });

  it('maps ReadRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.ReadRecord)).toBe('record-task');
  });

  it('maps UpdateRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.UpdateRecord)).toBe('record-task');
  });

  it('maps TriggerAction to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.TriggerAction)).toBe('record-task');
  });

  it('maps LoadRelatedRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.LoadRelatedRecord)).toBe('record-task');
  });

  it('falls through to record-task for an unknown future step type', () => {
    expect(stepTypeToOutcomeType('future-step-type' as StepType)).toBe('record-task');
  });
});
