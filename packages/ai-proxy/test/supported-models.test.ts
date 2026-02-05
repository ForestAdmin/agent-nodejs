import isModelSupportingTools, { validateModelSupportsTools } from '../src/supported-models';

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
});

describe('validateModelSupportsTools', () => {
  it('should not throw for supported models', () => {
    expect(() => validateModelSupportsTools('gpt-4o')).not.toThrow();
  });

  it('should throw for unsupported models', () => {
    expect(() => validateModelSupportsTools('gpt-4')).toThrow(
      "Model 'gpt-4' does not support tools. Please use a model that supports function calling.",
    );
  });
});
