import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';

/**
 * The OpenTelemetry setup. `tracing-preload.ts` is what actually runs it, via `--require` before
 * cli.js so the auto-instrumentation patches land before anything the app imports; keeping the two
 * apart is what lets this module be imported by a test without arming an SDK.
 *
 * The SDK is initialised only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so an install that never
 * opted into APM pays nothing. All configuration goes through the standard OTel environment
 * variables:
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

interface OtelSdk {
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
  /** Signal registration, as a seam: a test must not arm a handler on the real process. */
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
  raise?: (signal: NodeJS.Signals) => void;
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
 * Flushes buffered spans on the way out, then re-raises the signal so the default action terminates
 * the process. The BFF installs no signal handler of its own, and a listener SUPPRESSES the default
 * termination — arming one without re-raising would leave `docker stop` waiting out its timeout for
 * a SIGKILL. `once` has already removed this listener by the time the signal comes back around, so
 * the second delivery finds none and terminates.
 *
 * A failing flush must not keep the process alive either: the shutdown result is swallowed, the
 * signal is re-raised regardless.
 */
function armFlush(
  sdk: OtelSdk,
  options: Required<Pick<TracingOptions, 'onSignal' | 'raise'>>,
): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    options.onSignal(signal, () => {
      void sdk
        .shutdown()
        .catch(() => undefined)
        .then(() => options.raise(signal));
    });
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

export default function initTracing(options: TracingOptions = {}): OtelSdk | undefined {
  const {
    env = process.env,
    logger = createConsoleLogger(),
    load = loadOtelModules,
    onSignal = (signal, handler) => {
      process.once(signal, handler);
    },
    raise = signal => {
      process.kill(process.pid, signal);
    },
  } = options;

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
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  armFlush(sdk, { onSignal, raise });

  logger('Info', 'OpenTelemetry tracing enabled', { serviceName, endpoint });

  return sdk;
}
