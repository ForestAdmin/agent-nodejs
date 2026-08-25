import type { Logger } from '../src/ports/logger-port';
import type { OtelModules, TracingOptions } from '../src/tracing';

import initTracing, { DEFAULT_SERVICE_NAME } from '../src/tracing';

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
  let raise: jest.Mock;
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
      raise,
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
    raise = jest.fn();
  });

  describe('when OTEL_EXPORTER_OTLP_ENDPOINT is absent', () => {
    it('should not build an SDK', () => {
      const sdk = setup({ env: {} });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
      expect(logger).not.toHaveBeenCalled();
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
    it('should flush the spans, then re-raise the same signal so the default action terminates', async () => {
      setup();

      handlers.SIGTERM();
      await flushMicrotasks();

      expect(shutdown).toHaveBeenCalledTimes(1);
      expect(raise).toHaveBeenCalledWith('SIGTERM');
    });

    it('should re-raise SIGINT when SIGINT is what arrived', async () => {
      setup();

      handlers.SIGINT();
      await flushMicrotasks();

      expect(raise).toHaveBeenCalledWith('SIGINT');
    });

    it('should still re-raise when the flush rejects, so a failing exporter cannot hang the process', async () => {
      shutdown.mockRejectedValue(new Error('collector unreachable'));
      setup();

      handlers.SIGTERM();
      await flushMicrotasks();

      expect(raise).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
