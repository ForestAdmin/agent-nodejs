/**
 * The one piece of state the preload and the CLI have to share.
 *
 * `--require` runs the preload in its own module, before `cli.js` is even loaded, so the SDK it
 * builds has nowhere to go but a module both sides resolve to the same instance. Keeping it here —
 * rather than having the preload arm a signal handler of its own — is what lets the shutdown path
 * WAIT for the flush instead of racing it, and keeps the preload from consuming a signal the CLI
 * has not armed a handler for yet.
 *
 * Nothing OpenTelemetry-specific is imported here, so the npm bin pays only for an empty variable.
 */

export interface TracingHandle {
  shutdown(): Promise<void>;
}

let handle: TracingHandle | undefined;

export function setTracingHandle(sdk: TracingHandle | undefined): void {
  handle = sdk;
}

export function getTracingHandle(): TracingHandle | undefined {
  return handle;
}

/**
 * Flushes buffered spans, or resolves immediately when tracing was never armed — the shutdown path
 * should not have to know which. A failing export is swallowed: a dead collector must not turn a
 * clean shutdown into a failed one.
 *
 * No deadline here on purpose: `armShutdown` bounds whatever flush it is given, and it is the only
 * caller. Bounding it twice would say the deadline lives in two places when it does not.
 */
export async function flushTracing(): Promise<void> {
  try {
    await handle?.shutdown();
  } catch {
    /* istanbul ignore next — nothing to do about it, and it must not change the exit code. */
  }
}
