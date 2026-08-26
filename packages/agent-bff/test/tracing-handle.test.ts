import { flushTracing, getTracingHandle, setTracingHandle } from '../src/tracing-handle';

describe('tracing handle', () => {
  afterEach(() => {
    setTracingHandle(undefined);
  });

  it('should hand back the SDK the preload parked', () => {
    const sdk = { shutdown: jest.fn().mockResolvedValue(undefined) };

    setTracingHandle(sdk);

    expect(getTracingHandle()).toBe(sdk);
  });

  describe('flushTracing', () => {
    it('should flush through the parked SDK', async () => {
      const shutdown = jest.fn().mockResolvedValue(undefined);
      setTracingHandle({ shutdown });

      await flushTracing();

      expect(shutdown).toHaveBeenCalledTimes(1);
    });

    // The npm bin never arms one, and the shutdown path should not have to know that.
    it('should resolve when tracing was never armed', async () => {
      await expect(flushTracing()).resolves.toBeUndefined();
    });

    // A dead collector must not turn a clean shutdown into a failed one.
    it('should swallow a failing export', async () => {
      setTracingHandle({ shutdown: jest.fn().mockRejectedValue(new Error('collector down')) });

      await expect(flushTracing()).resolves.toBeUndefined();
    });
  });
});
