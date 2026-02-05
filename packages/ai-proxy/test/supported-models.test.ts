import isModelSupportingTools, { validateModelSupportsTools } from '../src/supported-models';

describe('isModelSupportingTools', () => {
  describe('should return true for supported models', () => {
    const supportedModels = [
      // GPT-4o family
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-08-06',
      'gpt-4o-audio-preview',
      'gpt-4o-search-preview',
      // GPT-4.1 family
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      // GPT-4 turbo
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-4-turbo-preview',
      // GPT-3.5 family
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-16k',
      // O-series (reasoning models)
      'o1',
      'o1-mini',
      'o1-preview',
      'o3',
      'o3-mini',
      'o4-mini',
      // Future models
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-5.1',
      'gpt-5.2',
      'unknown-model',
    ];

    it.each(supportedModels)('%s', model => {
      expect(isModelSupportingTools(model)).toBe(true);
    });
  });

  describe('should return false for unsupported models', () => {
    const unsupportedModels = [
      'gpt-4',
      'gpt-4-0613',
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
