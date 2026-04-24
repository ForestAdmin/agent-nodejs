import type { Logger } from '../../src/ports/logger-port';

import withRetry from '../../src/adapters/with-retry';

const makeLogger = (): jest.Mocked<Logger> => ({
  info: jest.fn(),
  error: jest.fn(),
});

const makeHttpError = (status: number) => {
  const err = new Error(`HTTP ${status}`);
  (err as Error & { status: number }).status = status;

  return err;
};

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns immediately when the call succeeds on first attempt', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await withRetry('test', fn, { logger });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('retries on retryable HTTP status codes (503)', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockRejectedValueOnce(makeHttpError(503)).mockResolvedValueOnce('ok');

    const promise = withRetry('test', fn, { logger });
    await jest.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '"test" failed, retrying',
      expect.objectContaining({ attempt: 1 }),
    );
  });

  it('retries on status 408 (request timeout)', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockRejectedValueOnce(makeHttpError(408)).mockResolvedValueOnce('ok');

    const promise = withRetry('test', fn, { logger });
    await jest.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe('ok');
  });

  it('retries on status 429 (rate limit)', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockRejectedValueOnce(makeHttpError(429)).mockResolvedValueOnce('ok');

    const promise = withRetry('test', fn, { logger });
    await jest.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe('ok');
  });

  it('honors the 100/500/2000 ms backoff', async () => {
    const logger = makeLogger();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeHttpError(503))
      .mockRejectedValueOnce(makeHttpError(503))
      .mockRejectedValueOnce(makeHttpError(503))
      .mockResolvedValueOnce('ok');

    const promise = withRetry('test', fn, { logger });

    await jest.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(promise).resolves.toBe('ok');
  });

  it('rethrows the original error after exhausting all 4 attempts', async () => {
    const logger = makeLogger();
    const finalErr = makeHttpError(500);
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeHttpError(500))
      .mockRejectedValueOnce(makeHttpError(500))
      .mockRejectedValueOnce(makeHttpError(500))
      .mockRejectedValueOnce(finalErr);

    let caught: unknown;
    const promise = withRetry('test', fn, { logger }).catch(err => {
      caught = err;
    });
    await jest.advanceTimersByTimeAsync(100 + 500 + 2000);
    await promise;

    expect(caught).toBe(finalErr);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('throws immediately on non-retryable errors (4xx)', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockRejectedValue(makeHttpError(400));

    await expect(withRetry('test', fn, { logger })).rejects.toMatchObject({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('throws immediately on errors with no status', async () => {
    const logger = makeLogger();
    const fn = jest.fn().mockRejectedValue(new Error('plain error'));

    await expect(withRetry('test', fn, { logger })).rejects.toThrow('plain error');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
