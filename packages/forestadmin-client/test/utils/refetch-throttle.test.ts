import RefetchThrottle, {
  FORCED_REFETCH_INTERVAL_IN_SECONDS,
} from '../../src/utils/refetch-throttle';

describe('RefetchThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow the first refetch of a key', () => {
    expect(new RefetchThrottle().tryAcquire('key')).toBe(true);
  });

  it('should refuse a second refetch of the same key within the interval', () => {
    const throttle = new RefetchThrottle();
    throttle.tryAcquire('key');

    jest.setSystemTime(FORCED_REFETCH_INTERVAL_IN_SECONDS * 1000 - 1);

    expect(throttle.tryAcquire('key')).toBe(false);
  });

  it('should allow a refetch of the same key once the interval has elapsed', () => {
    const throttle = new RefetchThrottle();
    throttle.tryAcquire('key');

    jest.setSystemTime(FORCED_REFETCH_INTERVAL_IN_SECONDS * 1000);

    expect(throttle.tryAcquire('key')).toBe(true);
  });

  it('should not restart the interval on a refused refetch', () => {
    const throttle = new RefetchThrottle();
    throttle.tryAcquire('key');
    jest.setSystemTime(1000);
    throttle.tryAcquire('key');

    jest.setSystemTime(FORCED_REFETCH_INTERVAL_IN_SECONDS * 1000);

    expect(throttle.tryAcquire('key')).toBe(true);
  });

  it('should allow a refetch after the clock stepped back', () => {
    const throttle = new RefetchThrottle();
    jest.setSystemTime(10000);
    throttle.tryAcquire('key');

    jest.setSystemTime(5000);

    expect(throttle.tryAcquire('key')).toBe(true);
  });

  it('should throttle each key independently', () => {
    const throttle = new RefetchThrottle();
    throttle.tryAcquire('key1');

    expect(throttle.tryAcquire('key2')).toBe(true);
  });

  it('should use the given interval', () => {
    const throttle = new RefetchThrottle(10);
    throttle.tryAcquire('key');

    jest.setSystemTime(10);

    expect(throttle.tryAcquire('key')).toBe(true);
  });
});
