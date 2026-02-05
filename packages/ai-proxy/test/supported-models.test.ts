import isModelSupportingTools, { validateModelSupportsTools } from '../src/supported-models';

describe('isModelSupportingTools', () => {
  describe('should return true for supported models', () => {
    const supportedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-08-06',
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-5',
      'o1',
      'o3-mini',
      'unknown-model',
      'future-gpt-model',
    ];

    it.each(supportedModels)('%s', model => {
      expect(isModelSupportingTools(model)).toBe(true);
    });
  });

  describe('should return false for unsupported models', () => {
    const unsupportedModels = [
      'gpt-4',
      'gpt-4-0613',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5',
      'text-davinci-003',
      'davinci',
      'curie',
      'babbage',
      'ada',
    ];

    it.each(unsupportedModels)('%s', model => {
      expect(isModelSupportingTools(model)).toBe(false);
    });
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
