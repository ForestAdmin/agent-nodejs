import isModelSupportingTools, {
  SUPPORTED_OPENAI_MODELS,
  validateModelSupportsTools,
} from '../src/supported-models';

describe('isModelSupportingTools', () => {
  describe('should return true for supported models', () => {
    const supportedModels = [
      ...SUPPORTED_OPENAI_MODELS,
      // Additional variants (dated versions)
      'gpt-4o-2024-08-06',
      'gpt-4o-audio-preview',
      'gpt-4o-search-preview',
      'gpt-4-turbo-2024-04-09',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-16k',
      // Unknown models are allowed by default
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
