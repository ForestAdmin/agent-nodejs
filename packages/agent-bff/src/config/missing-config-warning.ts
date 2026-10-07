import type { BFFConfig, ConfigKey, ConfigLabels } from './env-config';
import type { Logger } from '../ports/logger-port';

/**
 * The only place that names *which* required keys are absent. Both deployment modes call it at
 * assembly time, so a misconfiguration reads the same whether the BFF listens on its own port or is
 * mounted by a host that never starts a listener.
 */
export default function warnMissingConfig(
  config: BFFConfig,
  logger: Logger,
  labels: ConfigLabels = {},
): void {
  const missing = Object.entries(config.presence)
    .filter(([, present]) => !present)
    .map(([key]) => labels[key as ConfigKey] ?? key);

  if (missing.length === 0) return;

  logger('Warn', 'Missing required configuration; /health will report degraded', { missing });
}
