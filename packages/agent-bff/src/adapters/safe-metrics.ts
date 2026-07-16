import type { MetricTags, Metrics } from '../ports/metrics-port';

/**
 * Wraps a Metrics port so emitting a metric can never throw into business logic. Metrics is a
 * user-supplied implementation; a backend that throws must not break a request (e.g. a throwing
 * gauge on the schema cache-hit path would otherwise degrade every read).
 */
export default function safeMetrics(metrics: Metrics): Metrics {
  return {
    increment(name: string, tags?: MetricTags): void {
      try {
        metrics.increment(name, tags);
      } catch {
        // Swallow: a metrics-backend failure must never break business logic.
      }
    },
    gauge(name: string, value: number, tags?: MetricTags): void {
      try {
        metrics.gauge(name, value, tags);
      } catch {
        // Swallow: a metrics-backend failure must never break business logic.
      }
    },
  };
}
