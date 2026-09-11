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

  it.each(['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-6-astra'])(
    'should return false for %s (v1/responses only)',
    model => {
      expect(isModelSupportingTools(model)).toBe(false);
    },
  );

  // claude-fable-5-1 broke the integration suite on its release day; the whole line shares the
  // always-on thinking the proxy cannot carry, so point releases must be excluded on arrival.
  it.each(['claude-fable-5', 'claude-fable-5-1', 'claude-fable-5-20260101'])(
    'should return false for %s (always-on thinking incompatible with proxy)',
    model => {
      expect(isModelSupportingTools(model, 'anthropic')).toBe(false);
    },
  );

  it('should not exclude a model merely prefixed by an unsupported family name', () => {
    expect(isModelSupportingTools('claude-fable-50', 'anthropic')).toBe(true);
  });

  describe('bedrock', () => {
    it('reuses the anthropic denylist through the inference-profile and version wrappers', () => {
      expect(isModelSupportingTools('us.anthropic.claude-opus-4-20250514-v1:0', 'bedrock')).toBe(
        false,
      );
      expect(isModelSupportingTools('anthropic.claude-opus-4-20250514-v1:0', 'bedrock')).toBe(
        false,
      );
    });

    it.each(['eu.', 'apac.', 'global.', 'us-gov.'])(
      'strips the %s inference-profile prefix',
      prefix => {
        expect(isModelSupportingTools(`${prefix}anthropic.claude-fable-5-v1:0`, 'bedrock')).toBe(
          false,
        );
      },
    );

    it('allows a supported anthropic model on bedrock', () => {
      expect(isModelSupportingTools('us.anthropic.claude-sonnet-4-6-v1:0', 'bedrock')).toBe(true);
    });

    it('allows other vendors by default', () => {
      expect(isModelSupportingTools('amazon.nova-pro-v1:0', 'bedrock')).toBe(true);
      expect(isModelSupportingTools('meta.llama3-1-70b-instruct-v1:0', 'bedrock')).toBe(true);
    });

    it('does not apply the openai denylist to bedrock ids', () => {
      expect(isModelSupportingTools('meta.llama3-1-70b-instruct-v1:0')).toBe(false);
      expect(isModelSupportingTools('meta.llama3-1-70b-instruct-v1:0', 'bedrock')).toBe(true);
    });
  });

  it('should return true for other anthropic models', () => {
    expect(isModelSupportingTools('claude-opus-4-8', 'anthropic')).toBe(true);
  });
});
