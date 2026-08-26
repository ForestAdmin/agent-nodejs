import type { Logger } from '../src/ports/logger-port';
import type { OtelModules, TracingOptions } from '../src/tracing';

import initTracing, {
  DEFAULT_SERVICE_NAME,
  OTEL_MODULE_IDS,
  loadOtelModules,
  redactEndpoint,
} from '../src/tracing';

const ENDPOINT = 'http://collector:4318';

describe('initTracing', () => {
  let start: jest.Mock;
  let shutdown: jest.Mock;
  let NodeSDK: jest.Mock;
  let getNodeAutoInstrumentations: jest.Mock;
  let OTLPTraceExporter: jest.Mock;
  let logger: jest.MockedFunction<Logger>;

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
      ...options,
    });

  beforeEach(() => {
    start = jest.fn();
    shutdown = jest.fn().mockResolvedValue(undefined);
    NodeSDK = jest.fn().mockImplementation(() => ({ start, shutdown }));
    getNodeAutoInstrumentations = jest.fn().mockReturnValue('instrumentations');
    OTLPTraceExporter = jest.fn().mockImplementation(() => 'exporter');
    logger = jest.fn();
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

    // Container logs are the last place a collector token should end up, and this package echoes
    // no other secret anywhere.
    it('should keep collector credentials out of that log line', () => {
      setup({
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://user:s3cret@collector.example/v1/traces' },
      });

      const [, , context] = logger.mock.calls[0];
      expect(context?.endpoint).toBe('https://collector.example/v1/traces');
      expect(JSON.stringify(context)).not.toContain('s3cret');
    });

    // Supplying traceExporter puts NodeSDK on its manual path, where it never reads
    // OTEL_TRACES_EXPORTER — passing one unconditionally would silently ignore the standard way
    // to turn export off.
    it.each(['none', 'NONE', ' none '])(
      'should configure no exporter when OTEL_TRACES_EXPORTER is %p',
      raw => {
        setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: raw } });

        expect(NodeSDK).toHaveBeenCalledWith(
          expect.not.objectContaining({ traceExporter: expect.anything() }),
        );
        expect(OTLPTraceExporter).not.toHaveBeenCalled();
      },
    );

    // Only the export stops; the spans still get created, so trace context keeps propagating.
    it('should keep the instrumentations when export is turned off', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: 'none' } });

      expect(NodeSDK).toHaveBeenCalledWith(
        expect.objectContaining({ instrumentations: ['instrumentations'] }),
      );
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('should not name an endpoint it will not export to', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: 'none' } });

      expect(logger).toHaveBeenCalledWith('Info', 'OpenTelemetry tracing enabled', {
        serviceName: DEFAULT_SERVICE_NAME,
        exporter: 'none',
      });
    });

    it('should still export for any other exporter value', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: 'otlp' } });

      expect(NodeSDK).toHaveBeenCalledWith(
        expect.objectContaining({ traceExporter: expect.any(OTLPTraceExporter) }),
      );
    });

    it('should hand the SDK back for the shutdown path to flush through', () => {
      const sdk = setup();

      expect(sdk).toEqual(expect.objectContaining({ shutdown: expect.any(Function) }));
    });

    // Arming one here would swallow a signal the CLI has not armed its own handler for yet, and
    // nothing would then terminate the process.
    it('should register no signal handler of its own', () => {
      const once = jest.spyOn(process, 'once').mockReturnValue(process);
      const on = jest.spyOn(process, 'on').mockReturnValue(process);

      setup();

      expect(once).not.toHaveBeenCalled();
      expect(on).not.toHaveBeenCalled();
      jest.restoreAllMocks();
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

describe('redactEndpoint', () => {
  it('should leave an endpoint without credentials exactly as it is', () => {
    expect(redactEndpoint('http://collector:4318/v1/traces')).toBe(
      'http://collector:4318/v1/traces',
    );
  });

  it.each([
    ['a user and a password', 'https://user:s3cret@collector.example/v1/traces'],
    ['a token as the user', 'https://s3cret@collector.example/v1/traces'],
  ])('should strip %s while keeping the rest of the URL', (_label, endpoint) => {
    const redacted = redactEndpoint(endpoint);

    expect(redacted).toBe('https://collector.example/v1/traces');
    expect(redacted).not.toContain('s3cret');
  });

  // It cannot be redacted, so it cannot be shown. The SDK fails on it soon enough on its own.
  it('should drop an endpoint it cannot parse rather than pass it through', () => {
    expect(redactEndpoint('not a url')).toBeUndefined();
  });
});
