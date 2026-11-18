import { AiEnvConfigurationError, parseAiEnv } from '../src';

describe('parseAiEnv', () => {
  it('should return undefined when no AI variable is set', () => {
    expect(parseAiEnv({})).toBeUndefined();
  });

  it('should treat blank values as unset', () => {
    expect(parseAiEnv({ AI_PROVIDER: '', AI_MODEL: '', AI_API_KEY: '' })).toBeUndefined();
  });

  it('should build an anthropic configuration', () => {
    expect(
      parseAiEnv({ AI_PROVIDER: 'anthropic', AI_MODEL: 'claude', AI_API_KEY: 'sk-1' }),
    ).toEqual({ name: 'default', provider: 'anthropic', model: 'claude', apiKey: 'sk-1' });
  });

  it('should build an openai configuration', () => {
    expect(parseAiEnv({ AI_PROVIDER: 'openai', AI_MODEL: 'gpt-4.1', AI_API_KEY: 'sk-2' })).toEqual(
      { name: 'default', provider: 'openai', model: 'gpt-4.1', apiKey: 'sk-2' },
    );
  });

  it.each([
    ['AI_PROVIDER alone', { AI_PROVIDER: 'anthropic' }],
    ['AI_MODEL alone', { AI_MODEL: 'claude' }],
    ['AI_API_KEY alone', { AI_API_KEY: 'sk' }],
  ])('should refuse a partial configuration: %s', (_label, env) => {
    expect(() => parseAiEnv(env)).toThrow(AiEnvConfigurationError);
    expect(() => parseAiEnv(env)).toThrow('AI config must be all-or-nothing');
  });

  it('should refuse an unknown provider', () => {
    expect(() => parseAiEnv({ AI_PROVIDER: 'bogus', AI_MODEL: 'm', AI_API_KEY: 'k' })).toThrow(
      'AI_PROVIDER must be "anthropic", "openai" or "bedrock", got "bogus"',
    );
  });

  it.each(['anthropic', 'openai'])('should require an api key for %s', provider => {
    expect(() => parseAiEnv({ AI_PROVIDER: provider, AI_MODEL: 'm' })).toThrow(
      `AI_API_KEY is required for AI_PROVIDER=${provider}`,
    );
  });

  describe('with bedrock', () => {
    it('should take the region from AWS_REGION', () => {
      expect(parseAiEnv({ AI_PROVIDER: 'bedrock', AI_MODEL: 'm', AWS_REGION: 'eu-west-3' })).toEqual(
        { name: 'default', provider: 'bedrock', model: 'm', region: 'eu-west-3' },
      );
    });

    it('should fall back to AWS_DEFAULT_REGION', () => {
      expect(
        parseAiEnv({ AI_PROVIDER: 'bedrock', AI_MODEL: 'm', AWS_DEFAULT_REGION: 'us-east-1' }),
      ).toMatchObject({ region: 'us-east-1' });
    });

    it('should refuse an api key', () => {
      expect(() =>
        parseAiEnv({ AI_PROVIDER: 'bedrock', AI_MODEL: 'm', AI_API_KEY: 'k', AWS_REGION: 'r' }),
      ).toThrow('AI_API_KEY is not used with bedrock');
    });

    it('should require a region', () => {
      expect(() => parseAiEnv({ AI_PROVIDER: 'bedrock', AI_MODEL: 'm' })).toThrow(
        'AI_PROVIDER=bedrock requires AWS_REGION (or AWS_DEFAULT_REGION).',
      );
    });
  });

  describe('with other variable names', () => {
    const keys = { provider: 'BFF_AI_PROVIDER', model: 'BFF_AI_MODEL', apiKey: 'BFF_AI_API_KEY' };

    it('should read the given names and ignore the default ones', () => {
      expect(
        parseAiEnv(
          { BFF_AI_PROVIDER: 'openai', BFF_AI_MODEL: 'gpt', BFF_AI_API_KEY: 'k', AI_MODEL: 'x' },
          keys,
        ),
      ).toEqual({ name: 'default', provider: 'openai', model: 'gpt', apiKey: 'k' });
    });

    it('should name the variables through the label in its errors', () => {
      const label = (key: string) => `label:${key}`;

      expect(() => parseAiEnv({ BFF_AI_PROVIDER: 'openai' }, keys, label)).toThrow(
        'label:BFF_AI_PROVIDER and label:BFF_AI_MODEL',
      );
    });

    it('should name the region variable through the label', () => {
      const label = (key: string) => `label:${key}`;

      expect(() =>
        parseAiEnv({ BFF_AI_PROVIDER: 'bedrock', BFF_AI_MODEL: 'm' }, keys, label),
      ).toThrow('label:BFF_AI_PROVIDER=bedrock requires label:AWS_REGION (or AWS_DEFAULT_REGION).');
    });
  });
});
