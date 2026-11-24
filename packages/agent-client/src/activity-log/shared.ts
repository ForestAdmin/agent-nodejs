import type { ActivityLogLogger } from './types';

export const silentLogger: ActivityLogLogger = () => {};

export function describeCause(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function wait(delayMs: number): Promise<void> {
  return new Promise<void>(resolve => {
    // Unreferenced: a pending retry must not outlive the shutdown grace the drain enforces.
    setTimeout(resolve, delayMs).unref();
  });
}
