import { StepType } from '../src/index';

describe('StepType', () => {
  it('should expose exactly 6 step types', () => {
    const values = Object.values(StepType);
    expect(values).toHaveLength(6);
  });

  it.each([
    ['Condition', 'condition'],
    ['ReadRecord', 'read-record'],
    ['UpdateRecord', 'update-record'],
    ['TriggerAction', 'trigger-action'],
    ['LoadRelatedRecord', 'load-related-record'],
    ['McpTask', 'mcp'],
  ] as const)('should have %s = "%s"', (key, value) => {
    expect(StepType[key]).toBe(value);
  });
});
