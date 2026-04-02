import type { AiConfiguration } from '../src/provider';

import getAiConfiguration from '../src/get-ai-configuration';

const gpt4Config: AiConfiguration = {
  name: 'gpt4',
  provider: 'openai',
  apiKey: 'dev',
  model: 'gpt-4o',
};

const claudeConfig: AiConfiguration = {
  name: 'claude',
  provider: 'anthropic',
  apiKey: 'dev',
  model: 'claude-3-5-sonnet-latest',
};

describe('getAiConfiguration', () => {
  it('returns null when aiConfigurations is empty', () => {
    expect(getAiConfiguration([], 'gpt4')).toBeNull();
  });

  it('returns null when aiConfigurations is empty and no name provided', () => {
    expect(getAiConfiguration([])).toBeNull();
  });

  it('returns the matching config when aiName matches', () => {
    expect(getAiConfiguration([gpt4Config, claudeConfig], 'claude')).toBe(claudeConfig);
  });

  it('returns first config when aiName is not provided', () => {
    expect(getAiConfiguration([gpt4Config, claudeConfig])).toBe(gpt4Config);
  });

  it('returns first config when aiName is undefined', () => {
    expect(getAiConfiguration([gpt4Config, claudeConfig], undefined)).toBe(gpt4Config);
  });

  it('falls back to first config and logs warning when aiName not found', () => {
    const logger = jest.fn();

    const result = getAiConfiguration([gpt4Config, claudeConfig], 'non-existent', logger);

    expect(result).toBe(gpt4Config);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      "AI configuration 'non-existent' not found. Falling back to 'gpt4' (provider: openai, model: gpt-4o)",
    );
  });

  it('does not crash when logger is undefined and aiName not found', () => {
    const result = getAiConfiguration([gpt4Config], 'non-existent');

    expect(result).toBe(gpt4Config);
  });
});
