import createFixedWindowLimiter from '../../src/rate-limit/fixed-window-limiter';

const WINDOW_MS = 60_000;

function buildLimiter(maxEntries: number) {
  let current = 1_000_000;
  const limiter = createFixedWindowLimiter({
    windowMs: WINDOW_MS,
    maxRequests: 2,
    maxEntries,
    now: () => current,
  });

  return {
    limiter,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('fixed window limiter', () => {
  describe('when the bucket table is full', () => {
    it('should refuse a new key as saturated, with the delay to the earliest window reset', () => {
      const { limiter, advance } = buildLimiter(2);
      limiter.hit('first');
      advance(20_000);
      limiter.hit('second');

      const refusal = limiter.hit('third');

      expect(refusal).toEqual({ retryAfterSeconds: 40, saturated: true });
    });

    it('should keep serving the keys already tracked', () => {
      const { limiter } = buildLimiter(1);
      limiter.hit('first');
      limiter.hit('second');

      expect(limiter.hit('first')).toBeUndefined();
    });

    it('should accept a new key once a tracked window has expired', () => {
      const { limiter, advance } = buildLimiter(1);
      limiter.hit('first');
      advance(WINDOW_MS);

      expect(limiter.hit('second')).toBeUndefined();
    });
  });

  describe('when one key exceeds its budget', () => {
    it('should refuse it as not saturated', () => {
      const { limiter } = buildLimiter(10);
      limiter.hit('first');
      limiter.hit('first');

      expect(limiter.hit('first')).toEqual({ retryAfterSeconds: 60, saturated: false });
    });
  });
});
