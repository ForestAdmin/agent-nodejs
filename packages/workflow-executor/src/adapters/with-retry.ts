import type { Logger } from '../ports/logger-port';

import { extractErrorMessage } from '../errors';

const RETRY_DELAYS_MS = [100, 500, 2_000];
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set(['TypeError', 'TimeoutError', 'AbortError', 'FetchError']);

export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && RETRYABLE_ERROR_NAMES.has(err.name)) return true;

  const status =
    (err as { status?: number }).status ??
    (err as { response?: { status?: number } }).response?.status;

  return typeof status === 'number' && RETRYABLE_STATUS.has(status);
}

// Resolves after `ms` unless the signal aborts first, in which case it rejects with AbortError.
// Listener cleanup is done synchronously in both branches to avoid leaking on long-lived signals.
function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());

      return;
    }

    let timer: NodeJS.Timeout;

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export default async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  { logger, signal }: { logger: Logger; signal?: AbortSignal },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (signal?.aborted) throw new AbortError();

    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) throw err;
      logger.info(`"${label}" failed, retrying`, {
        attempt: attempt + 1,
        error: extractErrorMessage(err),
      });
      // eslint-disable-next-line no-await-in-loop
      await sleepOrAbort(RETRY_DELAYS_MS[attempt], signal);
    }
  }

  throw lastError;
}
