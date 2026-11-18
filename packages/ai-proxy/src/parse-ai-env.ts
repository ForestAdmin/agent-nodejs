import type { AiConfiguration } from './provider';

export class AiEnvConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiEnvConfigurationError';
  }
}

export interface AiEnvKeys {
  provider: string;
  model: string;
  apiKey: string;
}

export const AI_ENV_KEYS: AiEnvKeys = {
  provider: 'AI_PROVIDER',
  model: 'AI_MODEL',
  apiKey: 'AI_API_KEY',
};

const AI_CONFIG_NAME = 'default';

/**
 * Reads one AI provider configuration from the environment, with the runtime's rules, so every
 * component configured by `AI_*`-style variables accepts exactly the same values. `label` names a
 * variable in the messages, for callers whose user sets it under another name.
 */
export function parseAiEnv(
  env: NodeJS.ProcessEnv,
  keys: AiEnvKeys = AI_ENV_KEYS,
  label: (key: string) => string = key => key,
): AiConfiguration | undefined {
  const provider = env[keys.provider];
  const model = env[keys.model];
  const apiKey = env[keys.apiKey];
  const [providerName, modelName, apiKeyName] = [keys.provider, keys.model, keys.apiKey].map(label);

  if (!provider && !model && !apiKey) return undefined;

  if (!provider || !model) {
    throw new AiEnvConfigurationError(
      `AI config must be all-or-nothing: set ${providerName} and ${modelName} together (plus ` +
        `${apiKeyName}, except for bedrock) or leave all unset.`,
    );
  }

  if (provider === 'bedrock') {
    if (apiKey) {
      throw new AiEnvConfigurationError(
        `${apiKeyName} is not used with bedrock: credentials come from the AWS credential chain ` +
          '(IAM role, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, shared profile). Unset it.',
      );
    }

    // Checked here rather than left to the AWS SDK, which would only fail on the first AI call,
    // long after a misconfigured process reported itself healthy.
    const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;

    if (!region) {
      throw new AiEnvConfigurationError(
        `${providerName}=bedrock requires AWS_REGION (or AWS_DEFAULT_REGION).`,
      );
    }

    return { name: AI_CONFIG_NAME, provider: 'bedrock', model, region };
  }

  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new AiEnvConfigurationError(
      `${providerName} must be "anthropic", "openai" or "bedrock", got "${provider}"`,
    );
  }

  if (!apiKey) {
    throw new AiEnvConfigurationError(
      `${apiKeyName} is required for ${providerName}=${provider}. Only bedrock reads its ` +
        'credentials from the AWS credential chain.',
    );
  }

  return { name: AI_CONFIG_NAME, provider, model, apiKey } as AiConfiguration;
}
