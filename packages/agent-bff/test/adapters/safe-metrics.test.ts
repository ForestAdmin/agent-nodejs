import type { Metrics } from '../../src/ports/metrics-port';

import safeMetrics from '../../src/adapters/safe-metrics';

describe('safeMetrics', () => {
  it('should delegate increment and gauge to the wrapped metrics', () => {
    const inner: jest.Mocked<Metrics> = { increment: jest.fn(), gauge: jest.fn() };
    const metrics = safeMetrics(inner);

    metrics.increment('a', { collection: 'users' });
    metrics.gauge('b', 42, { rendering: 7 });

    expect(inner.increment).toHaveBeenCalledWith('a', { collection: 'users' });
    expect(inner.gauge).toHaveBeenCalledWith('b', 42, { rendering: 7 });
  });

  it('should swallow errors thrown by the wrapped increment', () => {
    const metrics = safeMetrics({
      increment: () => {
        throw new Error('backend down');
      },
      gauge: jest.fn(),
    });

    expect(() => metrics.increment('a')).not.toThrow();
  });

  it('should swallow errors thrown by the wrapped gauge', () => {
    const metrics = safeMetrics({
      increment: jest.fn(),
      gauge: () => {
        throw new Error('backend down');
      },
    });

    expect(() => metrics.gauge('b', 1)).not.toThrow();
  });
});
