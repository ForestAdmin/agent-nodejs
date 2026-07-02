import type { Logger } from '../ports/logger-port';
import type { MetricTags, Metrics } from '../ports/metrics-port';

import createConsoleLogger from './console-logger';

export default function createConsoleMetrics(logger: Logger = createConsoleLogger()): Metrics {
  return {
    increment(name: string, tags?: MetricTags): void {
      logger('Info', 'metric.increment', { metric: name, ...(tags ?? {}) });
    },
    gauge(name: string, value: number, tags?: MetricTags): void {
      logger('Info', 'metric.gauge', { metric: name, value, ...(tags ?? {}) });
    },
  };
}
