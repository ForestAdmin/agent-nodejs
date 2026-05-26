import type { Logger } from '../ports/logger-port';

import { extractErrorMessage } from '../errors';

const RETRY_DELAYS_MS = [100, 500, 2_000];
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isRetryable(err: unknown, retry404: boolean): boolean {
  const { status } = err as { status?: number };
  if (typeof status !== 'number') return false;
  if (retry404 && status === 404) return true;

  return RETRYABLE_STATUS.has(status);
}

export default async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  { logger, retry404 = false }: { logger: Logger; retry404?: boolean },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err, retry404) || attempt === RETRY_DELAYS_MS.length) throw err;
      logger.info(`"${label}" failed, retrying`, {
        attempt: attempt + 1,
        error: extractErrorMessage(err),
      });
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}
