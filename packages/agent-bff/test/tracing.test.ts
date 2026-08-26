import type { Logger } from '../src/ports/logger-port';
import type { OtelModules, TracingOptions } from '../src/tracing';

import initTracing, {
  DEFAULT_SERVICE_NAME,
  OTEL_MODULE_IDS,
  loadOtelModules,
} from '../src/tracing';

const ENDPOINT = 'http://collector:4318';

const flushMicrotasks = () =>
  new Promise(resolve => {
    setImmediate(resolve);
  });

describe('initTracing', () => {
  let start: jest.Mock;
  let shutdown: jest.Mock;
  let NodeSDK: jest.Mock;
  let getNodeAutoInstrumentations: jest.Mock;
  let OTLPTraceExporter: jest.Mock;
  let logger: jest.MockedFunction<Logger>;
  let onSignal: jest.Mock;
  let handlers: Record<string, () => void>;

  const modules = (): OtelModules =>
    ({
      NodeSDK,
      getNodeAutoInstrumentations,
      OTLPTraceExporter,
    } as unknown as OtelModules);

  const setup = (options: Partial<TracingOptions> = {}) =>
    initTracing({
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT },
      logger,
      load: () => modules(),
      onSignal,
      ...options,
    });

  beforeEach(() => {
    start = jest.fn();
    shutdown = jest.fn().mockResolvedValue(undefined);
    NodeSDK = jest.fn().mockImplementation(() => ({ start, shutdown }));
    getNodeAutoInstrumentations = jest.fn().mockReturnValue('instrumentations');
    OTLPTraceExporter = jest.fn().mockImplementation(() => 'exporter');
    logger = jest.fn();
    handlers = {};
    onSignal = jest.fn((signal: string, handler: () => void) => {
      handlers[signal] = handler;
    });
  });

  describe('when OTEL_EXPORTER_OTLP_ENDPOINT is absent', () => {
    it('should not build an SDK', () => {
      const sdk = setup({ env: {} });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
      expect(logger).not.toHaveBeenCalled();
    });

    it('should treat a blank endpoint as unset rather than export to the OTel default', () => {
      const sdk = setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: '   ' } });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
    });

    it('should report the trimmed endpoint it exports to', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ` ${ENDPOINT} ` } });

      expect(logger).toHaveBeenCalledWith(
        'Info',
        'OpenTelemetry tracing enabled',
        expect.objectContaining({ endpoint: ENDPOINT }),
      );
    });
  });

  describe('when OTEL_SDK_DISABLED is "true"', () => {
    it('should not build an SDK even with an endpoint configured', () => {
      const sdk = setup({
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_SDK_DISABLED: 'true' },
      });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
    });

    // The OTel spec defines its boolean variables as case-insensitive, and this one is the kill
    // switch: reading "TRUE" as "not disabled" leaves tracing on for someone asking it to stop.
    it.each(['TRUE', 'True', ' true '])('should also honour %p', raw => {
      const sdk = setup({
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_SDK_DISABLED: raw },
      });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
    });

    it('should build an SDK for any other value', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_SDK_DISABLED: 'false' } });

      expect(NodeSDK).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the OpenTelemetry packages are missing', () => {
    it('should warn and return no SDK instead of throwing', () => {
      const sdk = setup({ load: () => undefined });

      expect(sdk).toBeUndefined();
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'OpenTelemetry packages not available, skipping APM initialisation',
      );
    });
  });

  describe('when the packages are available', () => {
    it('should start an SDK carrying the OTLP exporter and the auto-instrumentations', () => {
      setup();

      expect(NodeSDK).toHaveBeenCalledWith({
        serviceName: DEFAULT_SERVICE_NAME,
        traceExporter: expect.any(OTLPTraceExporter),
        instrumentations: ['instrumentations'],
      });
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('should prefer OTEL_SERVICE_NAME over the default service name', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_SERVICE_NAME: 'bff-staging' } });

      expect(NodeSDK).toHaveBeenCalledWith(expect.objectContaining({ serviceName: 'bff-staging' }));
    });

    it('should log the service name and endpoint it reports to', () => {
      setup();

      expect(logger).toHaveBeenCalledWith('Info', 'OpenTelemetry tracing enabled', {
        serviceName: DEFAULT_SERVICE_NAME,
        endpoint: ENDPOINT,
      });
    });

    it('should arm a flush on SIGTERM and SIGINT', () => {
      setup();

      expect(onSignal.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGINT']);
    });
  });

  describe('on a termination signal', () => {
    it('should flush the buffered spans', async () => {
      setup();

      handlers.SIGTERM();
      await flushMicrotasks();

      expect(shutdown).toHaveBeenCalledTimes(1);
    });

    // Ending the process belongs to armShutdown, which closes the server first. A flush that
    // exited here would cut in-flight requests short; one that re-raised the signal would not
    // end anything at all, since the kernel gives PID 1 no default disposition.
    it('should leave ending the process to the shutdown handler', async () => {
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const kill = jest.spyOn(process, 'kill').mockReturnValue(true);
      setup();

      handlers.SIGTERM();
      await flushMicrotasks();

      expect(exit).not.toHaveBeenCalled();
      expect(kill).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should swallow a failing flush rather than leave an unhandled rejection behind', async () => {
      shutdown.mockRejectedValue(new Error('collector unreachable'));
      setup();

      handlers.SIGTERM();
      await flushMicrotasks();

      expect(shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe('with the signal seam left to its default', () => {
    let once: jest.SpyInstance;

    beforeEach(() => {
      once = jest.spyOn(process, 'once').mockReturnValue(process);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should register the flush on the real process', async () => {
      initTracing({
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT },
        logger,
        load: () => modules(),
      });

      expect(once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(once).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      const [, handler] = once.mock.calls[0] as [string, () => void];
      handler();
      await flushMicrotasks();

      expect(shutdown).toHaveBeenCalledTimes(1);
    });
  });
});

describe('loadOtelModules', () => {
  it('should take each entry point from the package that provides it', () => {
    const packageExports = {
      [OTEL_MODULE_IDS.sdk]: { NodeSDK: 'sdk' },
      [OTEL_MODULE_IDS.instrumentations]: { getNodeAutoInstrumentations: 'instrumentations' },
      [OTEL_MODULE_IDS.exporter]: { OTLPTraceExporter: 'exporter' },
    } as Record<string, Record<string, unknown>>;
    const load = jest.fn((id: string) => packageExports[id]);

    expect(loadOtelModules(load)).toEqual({
      NodeSDK: 'sdk',
      getNodeAutoInstrumentations: 'instrumentations',
      OTLPTraceExporter: 'exporter',
    });
    expect(load.mock.calls.map(([id]) => id)).toEqual([
      '@opentelemetry/sdk-node',
      '@opentelemetry/auto-instrumentations-node',
      '@opentelemetry/exporter-trace-otlp-http',
    ]);
  });

  it('should return undefined when a package cannot be resolved', () => {
    const load = jest.fn(() => {
      throw new Error("Cannot find module '@opentelemetry/sdk-node'");
    });

    expect(loadOtelModules(load)).toBeUndefined();
  });

  // The packages ship only in the Docker image, so this is the branch an npm consumer
  // takes: it must report their absence, not throw out of the preload.
  it('should return undefined against the real require, outside the Docker image', () => {
    expect(loadOtelModules()).toBeUndefined();
  });
});
