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
}

export interface TracingOptions {
  /**
   * The environment OUR decisions read: whether to arm at all, and what to name the service when
   * nothing else does. It stops there — the SDK reads the real `process.env` for everything about
   * the export itself, so a test injecting `env` cannot assert where spans go. Identical objects in
   * production, so this is a limit on what the seam can test, not a behaviour.
   */
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
  /** The dynamic require, as a seam: the packages exist only in the Docker image. */
  load?: () => OtelModules | undefined;
}

/** The packages this image installs for APM, and the export it takes from each. */
export const OTEL_MODULE_IDS = {
  sdk: '@opentelemetry/sdk-node',
  instrumentations: '@opentelemetry/auto-instrumentations-node',
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
    const modules = {
      NodeSDK: load(OTEL_MODULE_IDS.sdk).NodeSDK,
      getNodeAutoInstrumentations: load(OTEL_MODULE_IDS.instrumentations)
        .getNodeAutoInstrumentations,
    };

    // Resolving is not the same as finding what we came for. A package that loads but no longer
    // exports the name we read — a rename on a version bump — would otherwise hand back a truthy
    // object of undefined members, skip the "packages not available" branch, and throw a
    // TypeError inside a `--require`, before the entry point runs at all. That is a dead container
    // for an APM layer that is supposed to degrade to a warning.
    if (Object.values(modules).some(exported => typeof exported !== 'function')) return undefined;

    return modules as OtelModules;
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
 * The service name the environment already carries, by the spec's precedence: `OTEL_SERVICE_NAME`
 * wins, then a `service.name` entry in the comma-separated `OTEL_RESOURCE_ATTRIBUTES` list.
 * Undefined when neither names one, which is the only case where our own default should apply.
 */
export function serviceNameFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const explicit = env.OTEL_SERVICE_NAME?.trim();

  if (explicit) return explicit;

  return env.OTEL_RESOURCE_ATTRIBUTES?.split(',')
    .map(entry => entry.split('='))
    .filter(([key, value]) => key?.trim() === 'service.name' && value?.trim())
    .map(([, value]) => value.trim())
    .pop();
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

  // Any of the three standard ways to say "export traces somewhere" turns tracing on. The per-signal
  // endpoint counts as much as the generic one, and OTEL_TRACES_EXPORTER counts on its own —
  // requiring an OTLP collector before `console` does anything would be nonsense for an exporter
  // that writes to stdout, and it is the obvious first thing to reach for when debugging.
  //
  // A blank value counts as unset throughout, not as "export to the OTel default": `env_file` hands
  // an empty string through for a variable left blank in a `.env`, and arming the SDK against
  // localhost:4318 is not what leaving the line empty asks for.
  const endpoint =
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const requestedExporter = env.OTEL_TRACES_EXPORTER?.trim().toLowerCase();

  if ((!endpoint && !requestedExporter) || isDisabled(env.OTEL_SDK_DISABLED)) return undefined;

  const modules = load();

  if (!modules) {
    logger('Warn', 'OpenTelemetry packages not available, skipping APM initialisation');

    return undefined;
  }

  const { NodeSDK, getNodeAutoInstrumentations } = modules;

  // Passing `serviceName` unconditionally would override OTEL_RESOURCE_ATTRIBUTES=service.name=...,
  // which is a documented knob — someone setting only that would silently get our default. So we
  // fill it in only when the environment names no service at all, and otherwise leave the SDK to
  // apply the spec's own precedence (OTEL_SERVICE_NAME first, then the resource attribute).
  const named = serviceNameFromEnv(env);

  // No `traceExporter`, deliberately. Passing one puts NodeSDK on its manual-configuration path,
  // where it stops reading the environment — which is how OTEL_TRACES_EXPORTER, then
  // OTEL_EXPORTER_OTLP_PROTOCOL, then the per-signal endpoint each turned out to be silently
  // ignored, one review round after another. They were three symptoms of doing the SDK's job.
  //
  // sdk-node depends on every OTLP exporter and on the Zipkin one, so all of them are in the image
  // already; leaving the choice to the SDK costs nothing and makes the whole standard surface work,
  // protocol and per-signal overrides included. Our only decisions are whether to arm at all, and
  // the service name when nothing else supplies one.
  const sdk = new NodeSDK({
    ...(named ? {} : { serviceName: DEFAULT_SERVICE_NAME }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  // What was ASKED for, not what the SDK settled on — we no longer choose, so claiming a
  // destination we did not pick would be inventing one. The endpoint is dropped when an exporter
  // was named instead, since it would read as a promise this line cannot keep.
  logger('Info', 'OpenTelemetry tracing enabled', {
    serviceName: named ?? DEFAULT_SERVICE_NAME,
    ...(requestedExporter ? { exporter: requestedExporter } : {}),
    ...(endpoint && !requestedExporter ? { endpoint: redactEndpoint(endpoint) } : {}),
  });

  return sdk;
}
