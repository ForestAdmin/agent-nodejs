import type { Logger } from '../src/ports/logger-port';
import type { OtelModules, TracingOptions } from '../src/tracing';

import initTracing, {
  DEFAULT_SERVICE_NAME,
  OTEL_MODULE_IDS,
  loadOtelModules,
  redactEndpoint,
  serviceNameFromEnv,
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

  // Tracing is on as soon as either variable says so. Requiring an OTLP endpoint for
  // OTEL_TRACES_EXPORTER=console would make the obvious debugging move need a collector.
  describe('when only OTEL_TRACES_EXPORTER is set', () => {
    it('should still arm the SDK, with no endpoint of ours to hand it', () => {
      setup({ env: { OTEL_TRACES_EXPORTER: 'console' } });

      expect(NodeSDK).toHaveBeenCalledTimes(1);
      expect(OTLPTraceExporter).not.toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(
        'Info',
        'OpenTelemetry tracing enabled',
        expect.objectContaining({ exporter: 'console' }),
      );
    });

    it('should stay off when it is blank', () => {
      const sdk = setup({ env: { OTEL_TRACES_EXPORTER: '   ' } });

      expect(sdk).toBeUndefined();
      expect(NodeSDK).not.toHaveBeenCalled();
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

    // Passing serviceName would put our default ahead of the SDK's own precedence, so the two
    // documented ways of naming the service are left to it and only the fallback is ours.
    it.each([
      ['OTEL_SERVICE_NAME', { OTEL_SERVICE_NAME: 'bff-staging' }],
      ['a service.name resource attribute', { OTEL_RESOURCE_ATTRIBUTES: 'service.name=bff-attr' }],
    ])('should leave the service name to the SDK when %s is set', (_label, named) => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, ...named } });

      expect(NodeSDK).toHaveBeenCalledWith(
        expect.not.objectContaining({ serviceName: expect.anything() }),
      );
    });

    it('should report the name the environment carries, whichever way it was set', () => {
      setup({
        env: {
          OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT,
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=bff-attr',
        },
      });

      expect(logger).toHaveBeenCalledWith(
        'Info',
        'OpenTelemetry tracing enabled',
        expect.objectContaining({ serviceName: 'bff-attr' }),
      );
    });

    it('should fall back to its own default when the environment names no service', () => {
      setup();

      expect(NodeSDK).toHaveBeenCalledWith(
        expect.objectContaining({ serviceName: DEFAULT_SERVICE_NAME }),
      );
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
    // OTEL_TRACES_EXPORTER. Exporting to OTLP because we did not recognise the requested value
    // would send telemetry somewhere the operator never asked for.
    it.each(['none', 'NONE', ' none ', 'console', 'zipkin', 'otlp,console'])(
      'should leave the exporter to the SDK when OTEL_TRACES_EXPORTER is %p',
      raw => {
        setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: raw } });

        expect(NodeSDK).toHaveBeenCalledWith(
          expect.not.objectContaining({ traceExporter: expect.anything() }),
        );
        expect(OTLPTraceExporter).not.toHaveBeenCalled();
      },
    );

    // Only our exporter choice changes; the spans still get created, so context keeps propagating.
    it('should keep the instrumentations when the exporter is left to the SDK', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: 'none' } });

      expect(NodeSDK).toHaveBeenCalledWith(
        expect.objectContaining({ instrumentations: ['instrumentations'] }),
      );
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('should report which exporter was asked for instead of an endpoint it will not use', () => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: 'console' } });

      expect(logger).toHaveBeenCalledWith('Info', 'OpenTelemetry tracing enabled', {
        serviceName: DEFAULT_SERVICE_NAME,
        exporter: 'console',
      });
    });

    // Unset is our documented default; `otlp` is the same thing said out loud.
    it.each(['otlp', 'OTLP', ' otlp '])('should export over OTLP for %p', raw => {
      setup({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_TRACES_EXPORTER: raw } });

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

describe('serviceNameFromEnv', () => {
  it('should prefer OTEL_SERVICE_NAME', () => {
    expect(
      serviceNameFromEnv({
        OTEL_SERVICE_NAME: 'explicit',
        OTEL_RESOURCE_ATTRIBUTES: 'service.name=attribute',
      }),
    ).toBe('explicit');
  });

  it('should fall back to service.name in the resource attributes', () => {
    expect(
      serviceNameFromEnv({
        OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment=prod,service.name=from-attributes',
      }),
    ).toBe('from-attributes');
  });

  it.each([
    ['neither is set', {}],
    ['both are blank', { OTEL_SERVICE_NAME: '  ', OTEL_RESOURCE_ATTRIBUTES: 'service.name=  ' }],
    ['the attributes name something else', { OTEL_RESOURCE_ATTRIBUTES: 'host.name=box' }],
  ])('should report no name when %s', (_label, env) => {
    expect(serviceNameFromEnv(env)).toBeUndefined();
  });
});

describe('loadOtelModules', () => {
  it('should take each entry point from the package that provides it', () => {
    const NodeSDK = () => undefined;
    const getNodeAutoInstrumentations = () => undefined;
    const OTLPTraceExporter = () => undefined;
    const packageExports = {
      [OTEL_MODULE_IDS.sdk]: { NodeSDK },
      [OTEL_MODULE_IDS.instrumentations]: { getNodeAutoInstrumentations },
      [OTEL_MODULE_IDS.exporter]: { OTLPTraceExporter },
    } as Record<string, Record<string, unknown>>;
    const load = jest.fn((id: string) => packageExports[id]);

    expect(loadOtelModules(load)).toEqual({
      NodeSDK,
      getNodeAutoInstrumentations,
      OTLPTraceExporter,
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

  // Resolving is not finding what we came for. A truthy object of undefined members would skip the
  // "packages not available" branch and throw a TypeError inside a --require, before the entry
  // point runs — a dead container for an APM layer that is meant to degrade to a warning.
  it.each([
    ['sdk-node', OTEL_MODULE_IDS.sdk],
    ['auto-instrumentations-node', OTEL_MODULE_IDS.instrumentations],
    ['exporter-trace-otlp-http', OTEL_MODULE_IDS.exporter],
  ])('should return undefined when %s loads without the export we read', (_label, missing) => {
    const complete = {
      [OTEL_MODULE_IDS.sdk]: { NodeSDK: () => undefined },
      [OTEL_MODULE_IDS.instrumentations]: { getNodeAutoInstrumentations: () => undefined },
      [OTEL_MODULE_IDS.exporter]: { OTLPTraceExporter: () => undefined },
    } as Record<string, Record<string, unknown>>;

    expect(loadOtelModules(id => (id === missing ? {} : complete[id]))).toBeUndefined();
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
