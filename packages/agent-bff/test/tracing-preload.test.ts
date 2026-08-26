import type * as TracingHandleModule from '../src/tracing-handle';

import initTracing from '../src/tracing';

type TracingHandle = TracingHandleModule.TracingHandle;

jest.mock('../src/tracing', () => ({
  __esModule: true,
  default: jest.fn(),
}));

/**
 * The preload and the handle have to come from the SAME module registry, or the preload parks the
 * SDK on a copy nothing else can see — which is exactly the failure mode this file guards against
 * in production too.
 */
function loadPreload(): TracingHandle | undefined {
  let parked: TracingHandle | undefined;

  jest.isolateModules(() => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    require('../src/tracing-preload');
    parked = (require('../src/tracing-handle') as typeof TracingHandleModule).getTracingHandle();
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
  });

  return parked;
}

describe('tracing-preload', () => {
  beforeEach(() => {
    (initTracing as jest.Mock).mockReset();
  });

  it('should arm tracing as soon as it is required, since --require is all that runs it', () => {
    loadPreload();

    expect(initTracing).toHaveBeenCalledTimes(1);
    expect(initTracing).toHaveBeenCalledWith();
  });

  // Parking it rather than arming a signal handler is what lets the shutdown path wait for the
  // flush, and keeps the preload from swallowing a signal the CLI has not armed a handler for yet.
  it('should park the SDK on the handle for the shutdown path to flush', () => {
    const sdk = { shutdown: jest.fn() };
    (initTracing as jest.Mock).mockReturnValue(sdk);

    expect(loadPreload()).toBe(sdk);
  });

  it('should park nothing when tracing stayed off', () => {
    (initTracing as jest.Mock).mockReturnValue(undefined);

    expect(loadPreload()).toBeUndefined();
  });

  // A --require runs before the entry point, so anything thrown here kills the process before the
  // BFF exists — a dead container in exchange for optional telemetry.
  it('should start untraced rather than let a failing setup abort the process', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (initTracing as jest.Mock).mockImplementation(() => {
      throw new Error('sdk.start blew up');
    });

    expect(loadPreload()).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(warn.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: 'Warn',
      message: 'OpenTelemetry failed to initialise, starting untraced',
      reason: 'sdk.start blew up',
    });

    jest.restoreAllMocks();
  });
});
