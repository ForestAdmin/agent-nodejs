import type { AiConfiguration } from './provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

export default function getAiConfiguration(
  aiConfigurations: AiConfiguration[],
  aiName?: string,
  logger?: Logger,
): AiConfiguration | null {
  if (aiConfigurations.length === 0) return null;

  if (aiName) {
    const config = aiConfigurations.find(c => c.name === aiName);

    if (!config) {
      const fallback = aiConfigurations[0];
      logger?.(
        'Warn',
        `AI configuration '${aiName}' not found. Falling back to '${fallback.name}' (provider: ${fallback.provider}, model: ${fallback.model})`,
      );

      return fallback;
    }

    return config;
  }

  return aiConfigurations[0];
}
