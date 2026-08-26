import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';

/**
 * The OpenTelemetry setup. `tracing-preload.ts` is what actually runs it, via `--require` before
 * cli.js so the auto-instrumentation patches land before anything the app imports; keeping the two
 * apart is what lets this module be imported by a test without arming an SDK.
 *
 * The SDK is initialised only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so an install that never
 * opted into APM pays nothing. Neither ending the process nor flushing on the way out is this
 * module's business: it hands the SDK back, the preload parks it in `tracing-handle`, and the
 * shutdown path flushes through that. Arming a signal handler here would consume a signal the CLI
 * has not armed its own handler for yet, and nothing would then terminate the process.
 * All configuration goes through the standard OTel environment variables:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT   OTLP receiver (e.g. http://localhost:4318)
 *   OTEL_SERVICE_NAME             default: forestadmin-agent-bff
 *   OTEL_SDK_DISABLED             set to "true" to force-disable
 *   OTEL_RESOURCE_ATTRIBUTES      e.g. deployment.environment=production
 *
 * The OTel packages are installed only into the Docker image's isolated deps (see
 * `packages/agent-bff/docker/`), never shipped to npm consumers of the CLI — hence the dynamic
 * require behind a seam, and the warning rather than a crash when they are absent.
 */

export const DEFAULT_SERVICE_NAME = 'forestadmin-agent-bff';

export interface OtelSdk {
  start(): void;
  shutdown(): Promise<void>;
}

export interface OtelModules {
  NodeSDK: new (options: Record<string, unknown>) => OtelSdk;
  getNodeAutoInstrumentations: () => unknown;
  OTLPTraceExporter: new () => unknown;
}

export interface TracingOptions {
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
  /** The dynamic require, as a seam: the packages exist only in the Docker image. */
  load?: () => OtelModules | undefined;
}

/** The packages this image installs for APM, and the export it takes from each. */
export const OTEL_MODULE_IDS = {
  sdk: '@opentelemetry/sdk-node',
  instrumentations: '@opentelemetry/auto-instrumentations-node',
  exporter: '@opentelemetry/exporter-trace-otlp-http',
} as const;

/**
 * The module resolution, as a seam. These packages are absent everywhere except the Docker image,
 * so the real `require` can only ever take the failure branch here — passing a loader is what lets
 * the success branch, and the package ids it asks for, be exercised at all. A typo in one of them
 * would otherwise surface as an untraced image and nothing else.
 */
export type ModuleLoader = (id: string) => Record<string, unknown>;

export function loadOtelModules(load: ModuleLoader = require): OtelModules | undefined {
  try {
    return {
      NodeSDK: load(OTEL_MODULE_IDS.sdk).NodeSDK,
      getNodeAutoInstrumentations: load(OTEL_MODULE_IDS.instrumentations)
        .getNodeAutoInstrumentations,
      OTLPTraceExporter: load(OTEL_MODULE_IDS.exporter).OTLPTraceExporter,
    } as OtelModules;
  } catch {
    return undefined;
  }
}

/**
 * The OTel specification defines its boolean environment variables as case-insensitive, and this
 * one is the kill switch: reading `TRUE` as "not disabled" would leave tracing running for someone
 * who just asked for it to stop.
 */
function isDisabled(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

/**
 * Strips the credentials out of the endpoint before it reaches the logs. `https://user:token@host`
 * is a legitimate way to reach a collector behind basic auth, and container logs are the last place
 * that token should end up — this package does not echo a secret anywhere else either.
 *
 * An endpoint that does not parse is dropped from the log entirely rather than passed through: it
 * cannot be redacted, so it cannot be shown. The SDK will fail on it soon enough on its own.
 */
export function redactEndpoint(endpoint: string): string | undefined {
  try {
    const url = new URL(endpoint);

    if (!url.username && !url.password) return endpoint;

    url.username = '';
    url.password = '';

    return url.toString();
  } catch {
    return undefined;
  }
}

export default function initTracing(options: TracingOptions = {}): OtelSdk | undefined {
  const { env = process.env, logger = createConsoleLogger(), load = loadOtelModules } = options;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

  // A blank endpoint counts as unset, not as "export to the OTel default": `env_file` hands an
  // empty string through for a variable left blank in a `.env`, and arming the SDK against
  // localhost:4318 is not what leaving the line empty asks for.
  if (!endpoint || isDisabled(env.OTEL_SDK_DISABLED)) return undefined;

  const modules = load();

  if (!modules) {
    logger('Warn', 'OpenTelemetry packages not available, skipping APM initialisation');

    return undefined;
  }

  const { NodeSDK, getNodeAutoInstrumentations, OTLPTraceExporter } = modules;
  const serviceName = env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME;

  // Supplying `traceExporter` puts NodeSDK on its manual-configuration path, where it never reads
  // OTEL_TRACES_EXPORTER. So we only supply one when the operator has not asked for something else:
  // unset (our documented default, OTLP to the configured endpoint) or `otlp` (the same thing, said
  // out loud). Anything else — `none`, `console`, `zipkin`, a list — is handed back to the SDK,
  // which configures it from the environment. Sending spans to the OTLP endpoint because we did not
  // recognise the value would be worse than not sending them: it is telemetry going somewhere the
  // operator did not ask for, and the SDK says so out loud when it cannot honour the request.
  //
  // Instrumentation stays on in every case, so trace context keeps propagating to the agent and the
  // Forest SaaS whatever the export does.
  const requestedExporter = env.OTEL_TRACES_EXPORTER?.trim().toLowerCase();
  const exportsTraces = !requestedExporter || requestedExporter === 'otlp';
  const sdk = new NodeSDK({
    serviceName,
    ...(exportsTraces ? { traceExporter: new OTLPTraceExporter() } : {}),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  logger('Info', 'OpenTelemetry tracing enabled', {
    serviceName,
    // Naming the endpoint it will not export to would read as a promise it is not keeping. Saying
    // which exporter was asked for instead is what an operator needs to see when the SDK, not us,
    // is the one deciding.
    ...(exportsTraces ? { endpoint: redactEndpoint(endpoint) } : { exporter: requestedExporter }),
  });

  return sdk;
}
