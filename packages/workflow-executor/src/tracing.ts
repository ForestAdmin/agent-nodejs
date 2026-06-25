// Loaded via --require before cli.js to ensure instrumentation patches run first.
// Initialises the OpenTelemetry SDK only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
// All configuration is handled via standard OTel environment variables:
//   OTEL_EXPORTER_OTLP_ENDPOINT   OTLP receiver (e.g. http://localhost:4318)
//   OTEL_SERVICE_NAME              default: forestadmin-workflow-executor
//   OTEL_SDK_DISABLED              set to "true" to force-disable
//   OTEL_RESOURCE_ATTRIBUTES       e.g. deployment.environment=production,version=1.7.0
//
// The OTel packages are installed only into the Docker image's isolated deps
// (see packages/workflow-executor/docker/), never shipped to npm consumers of
// the CLI — hence the dynamic require guarded by a try/catch.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_SDK_DISABLED !== 'true') {
  try {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires, import/no-extraneous-dependencies */
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    /* eslint-enable global-require, @typescript-eslint/no-var-requires, import/no-extraneous-dependencies */

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || 'forestadmin-workflow-executor',
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();

    // Flush buffered spans on graceful shutdown. We must NOT call process.exit
    // here: the executor's own SIGTERM/SIGINT handler drains in-flight steps
    // (up to stopTimeoutMs) and owns the exit. We only flush in parallel — once
    // the SDK shutdown and the drain both settle, the event loop empties and the
    // process exits naturally (the executor keeps its own force-exit safety net).
    const flush = () => {
      void sdk.shutdown();
    };

    process.once('SIGTERM', flush);
    process.once('SIGINT', flush);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[tracing] OpenTelemetry packages not available, skipping APM initialisation');
  }
}
