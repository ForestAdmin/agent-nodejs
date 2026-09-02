import type { Logger } from '../src/ports/logger-port';

import armShutdown, { DEFAULT_GRACE_MS, FORCE_EXIT_MS } from '../src/shutdown';

const settle = () =>
  new Promise(resolve => {
    setImmediate(resolve);
  });

describe('armShutdown', () => {
  let stop: jest.Mock;
  let exit: jest.Mock;
  let logger: jest.MockedFunction<Logger>;
  let handlers: Record<string, () => void>;
  let onSignal: jest.Mock;

  const arm = (graceMs?: number) =>
    armShutdown({ server: { stop }, logger, onSignal, exit, graceMs });

  beforeEach(() => {
    stop = jest.fn().mockResolvedValue(undefined);
    exit = jest.fn();
    logger = jest.fn();
    handlers = {};
    onSignal = jest.fn((signal: string, handler: () => void) => {
      handlers[signal] = handler;
    });
  });

  it('should listen for both termination signals', () => {
    arm();

    expect(onSignal.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGINT']);
  });

  describe('on the first signal', () => {
    it('should stop the server with the grace period, then exit 0', async () => {
      arm(500);

      handlers.SIGTERM();
      await settle();

      expect(stop).toHaveBeenCalledWith(500);
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('should default the grace period rather than wait forever', async () => {
      arm();

      handlers.SIGINT();
      await settle();

      expect(stop).toHaveBeenCalledWith(DEFAULT_GRACE_MS);
    });

    // Node gives PID 1 no default disposition for an unhandled signal, so a handler that
    // does not exit explicitly leaves the container running until it is SIGKILLed.
    it('should exit even when the server fails to close', async () => {
      stop.mockRejectedValue(new Error('close failed'));
      arm();

      handlers.SIGTERM();
      await settle();

      expect(exit).toHaveBeenCalledWith(1);
      expect(logger).toHaveBeenCalledWith('Error', 'Shutdown failed, exiting anyway', {
        signal: 'SIGTERM',
      });
    });
  });

  describe('with a flush to run', () => {
    it('should run it alongside the stop and exit only once both settle', async () => {
      let releaseFlush: () => void = () => undefined;
      const flush = jest.fn(
        () =>
          new Promise<void>(resolve => {
            releaseFlush = resolve;
          }),
      );
      armShutdown({ server: { stop }, logger, onSignal, exit, flush, flushMs: 500 });

      handlers.SIGTERM();
      await settle();

      expect(flush).toHaveBeenCalledTimes(1);
      expect(exit).not.toHaveBeenCalled();

      releaseFlush();
      await settle();

      expect(exit).toHaveBeenCalledWith(0);
    });

    // A collector that never answers must cost the shutdown its last spans, not its ability to end.
    // The deadline is the flush's own: telemetry does not get the grace period in-flight requests do.
    it('should give up on the flush once its own deadline elapses', async () => {
      jest.useFakeTimers();
      const flush = jest.fn(
        () =>
          new Promise<void>(() => {
            /* never settles */
          }),
      );
      armShutdown({ server: { stop }, logger, onSignal, exit, flush, flushMs: 500 });

      handlers.SIGTERM();
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      jest.useRealTimers();
      await settle();

      expect(exit).toHaveBeenCalledWith(0);
    });

    // Promise.all is fail-fast: a rejected stop() would exit while the export was still in
    // flight, losing exactly the spans that explain the failed shutdown.
    it('should still wait for the flush when the server fails to close', async () => {
      let releaseFlush: () => void = () => undefined;
      const flush = jest.fn(
        () =>
          new Promise<void>(resolve => {
            releaseFlush = resolve;
          }),
      );
      stop.mockRejectedValue(new Error('close failed'));
      armShutdown({ server: { stop }, logger, onSignal, exit, flush, flushMs: 500 });

      handlers.SIGTERM();
      await settle();

      expect(exit).not.toHaveBeenCalled();

      releaseFlush();
      await settle();

      expect(exit).toHaveBeenCalledWith(1);
      expect(logger).toHaveBeenCalledWith('Error', 'Shutdown failed, exiting anyway', {
        signal: 'SIGTERM',
      });
    });

    it('should not let a failing flush change the exit code', async () => {
      const flush = jest.fn().mockRejectedValue(new Error('collector down'));
      armShutdown({ server: { stop }, logger, onSignal, exit, flush });

      handlers.SIGTERM();
      await settle();

      expect(exit).toHaveBeenCalledWith(0);
    });
  });

  describe('on a second signal', () => {
    it('should exit 1 instead of stopping the server again', async () => {
      let release: () => void = () => undefined;
      stop.mockReturnValue(
        new Promise<void>(resolve => {
          release = resolve;
        }),
      );
      arm();

      handlers.SIGTERM();
      handlers.SIGINT();

      expect(stop).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);

      release();
      await settle();
    });

    it('should not let the interrupted stop report success once it finishes', async () => {
      let release: () => void = () => undefined;
      stop.mockReturnValue(
        new Promise<void>(resolve => {
          release = resolve;
        }),
      );
      arm();

      handlers.SIGTERM();
      handlers.SIGINT();
      release();
      await settle();

      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      expect(logger).not.toHaveBeenCalledWith('Info', 'Forest BFF stopped');
    });

    it('should stay quiet when the interrupted stop fails too', async () => {
      let fail: (error: Error) => void = () => undefined;
      stop.mockReturnValue(
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
      );
      arm();

      handlers.SIGTERM();
      handlers.SIGINT();
      fail(new Error('close failed'));
      await settle();

      expect(exit).toHaveBeenCalledTimes(1);
      expect(logger).not.toHaveBeenCalledWith(
        'Error',
        'Shutdown failed, exiting anyway',
        expect.anything(),
      );
    });
  });

  describe('with the signal seam left to its default', () => {
    it('should register both handlers on the real process', () => {
      const on = jest.spyOn(process, 'on').mockReturnValue(process);

      armShutdown({ server: { stop }, exit });

      expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      jest.restoreAllMocks();
    });
  });

  describe('with the exit seam left to its default', () => {
    // process.exit would discard whatever is still buffered on stdout, and stdout is a pipe
    // under Docker — the shutdown lines would never reach `docker logs`.
    it('should set the exit code and let the loop drain rather than exit outright', async () => {
      jest.useFakeTimers();
      const hardExit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const previous = process.exitCode;

      armShutdown({ server: { stop }, onSignal });
      handlers.SIGTERM();
      await Promise.resolve();
      await Promise.resolve();

      expect(process.exitCode).toBe(0);
      expect(hardExit).not.toHaveBeenCalled();

      process.exitCode = previous;
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('should force the exit when something else keeps the loop alive', async () => {
      jest.useFakeTimers();
      const hardExit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const previous = process.exitCode;

      armShutdown({ server: { stop }, onSignal });
      handlers.SIGTERM();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(FORCE_EXIT_MS);

      expect(hardExit).toHaveBeenCalledWith(0);

      process.exitCode = previous;
      jest.restoreAllMocks();
      jest.useRealTimers();
    });
  });
});
