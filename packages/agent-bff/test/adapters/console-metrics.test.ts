import type { Logger } from '../../src/ports/logger-port';

import createConsoleMetrics from '../../src/adapters/console-metrics';

describe('createConsoleMetrics', () => {
  let logger: jest.MockedFunction<Logger>;

  beforeEach(() => {
    logger = jest.fn();
  });

  describe('increment', () => {
    it('should log the metric name and tags', () => {
      const metrics = createConsoleMetrics(logger);

      metrics.increment('schema_cache_refresh_error', { collection: 'users', action: 'ban' });

      expect(logger).toHaveBeenCalledWith('Info', 'metric.increment', {
        metric: 'schema_cache_refresh_error',
        collection: 'users',
        action: 'ban',
      });
    });

    it('should log without tags when none are provided', () => {
      const metrics = createConsoleMetrics(logger);

      metrics.increment('schema_cache_refresh_error');

      expect(logger).toHaveBeenCalledWith('Info', 'metric.increment', {
        metric: 'schema_cache_refresh_error',
      });
    });
  });

  describe('gauge', () => {
    it('should log the metric name, value and tags', () => {
      const metrics = createConsoleMetrics(logger);

      metrics.gauge('schema_cache_age_seconds', 42, { rendering: 7 });

      expect(logger).toHaveBeenCalledWith('Info', 'metric.gauge', {
        metric: 'schema_cache_age_seconds',
        value: 42,
        rendering: 7,
      });
    });
  });
});
