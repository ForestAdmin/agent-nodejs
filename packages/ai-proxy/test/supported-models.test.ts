import isModelSupportingTools from '../src/supported-models';

describe('isModelSupportingTools', () => {
  it('should return true for a known supported model', () => {
    expect(isModelSupportingTools('gpt-4o')).toBe(true);
  });

  it('should return true for an unknown model (allowed by default)', () => {
    expect(isModelSupportingTools('unknown-future-model')).toBe(true);
  });

  it('should return false for a blacklisted model', () => {
    expect(isModelSupportingTools('gpt-4')).toBe(false);
  });

  it.each(['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra'])(
    'should return false for %s (v1/responses only)',
    model => {
      expect(isModelSupportingTools(model)).toBe(false);
    },
  );

  it('should return false for claude-fable-5 (always-on thinking incompatible with proxy)', () => {
    expect(isModelSupportingTools('claude-fable-5', 'anthropic')).toBe(false);
  });

  it('should return true for other anthropic models', () => {
    expect(isModelSupportingTools('claude-opus-4-8', 'anthropic')).toBe(true);
  });
});
