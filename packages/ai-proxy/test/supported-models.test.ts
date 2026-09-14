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

  it.each(['gpt-live-1', 'gpt-4o-realtime-preview', 'gpt-4o-audio-preview'])(
    'should return false for %s (not a chat completions model)',
    model => {
      expect(isModelSupportingTools(model)).toBe(false);
    },
  );

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
    it.each([
      'eu.anthropic.claude-sonnet-5-v1:0',
      'us.anthropic.claude-opus-4-5-v1:0',
      'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      'anthropic.claude-sonnet-4-6-v1:0',
    ])('allows the sonnet/haiku/opus lines: %s', model => {
      expect(isModelSupportingTools(model, 'bedrock')).toBe(true);
    });

    it.each(['us.', 'eu.', 'apac.', 'jp.', 'au.', 'global.', 'us-gov.'])(
      'unwraps the %s inference-profile prefix',
      prefix => {
        expect(isModelSupportingTools(`${prefix}anthropic.claude-sonnet-5-v1:0`, 'bedrock')).toBe(
          true,
        );
      },
    );

    it.each([
      'eu.amazon.nova-pro-v1:0',
      'eu.amazon.nova-lite-v1:0',
      'amazon.titan-text-express-v1',
      'meta.llama3-3-70b-instruct-v1:0',
      'mistral.mistral-large-2407-v1:0',
      'cohere.command-r-plus-v1:0',
    ])('rejects every non-Claude vendor: %s', model => {
      expect(isModelSupportingTools(model, 'bedrock')).toBe(false);
    });

    it.each(['eu.anthropic.claude-fable-5-1-v1:0', 'us.anthropic.claude-mythos-5-v1:0'])(
      'rejects Claude lines outside sonnet/haiku/opus: %s',
      model => {
        expect(isModelSupportingTools(model, 'bedrock')).toBe(false);
      },
    );

    it.each([
      'us.anthropic.claude-opus-4-20250514-v1:0',
      'us.anthropic.claude-opus-4-1-20250805-v1:0',
    ])('still applies the anthropic denylist through the wrapper: %s', model => {
      expect(isModelSupportingTools(model, 'bedrock')).toBe(false);
    });

    it('rejects an id carrying no vendor prefix', () => {
      expect(isModelSupportingTools('claude-sonnet-5', 'bedrock')).toBe(false);
    });
  });

  it('should return true for other anthropic models', () => {
    expect(isModelSupportingTools('claude-opus-4-8', 'anthropic')).toBe(true);
  });
});
