import type {
  ActivityLogHandle,
  ActivityLogPort,
  CreateActivityLogArgs,
} from '../ports/activity-log-port';
import type { Logger } from '../ports/logger-port';
import type {
  ActivityLogAction,
  ActivityLogsServiceInterface,
} from '@forestadmin/forestadmin-client';

import { ActivityLogCreationError, extractErrorMessage } from '../errors';

const RETRY_DELAYS_MS = [100, 500, 2_000];
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set(['TypeError', 'TimeoutError', 'AbortError', 'FetchError']);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && RETRYABLE_ERROR_NAMES.has(err.name)) return true;

  const status =
    (err as { status?: number }).status ??
    (err as { response?: { status?: number } }).response?.status;

  return typeof status === 'number' && RETRYABLE_STATUS.has(status);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, logger: Logger): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) throw err;
      logger.info(`Activity log call "${label}" failed, retrying`, {
        attempt: attempt + 1,
        error: extractErrorMessage(err),
      });
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export default class ForestadminClientActivityLogPort implements ActivityLogPort {
  constructor(
    private readonly service: ActivityLogsServiceInterface,
    private readonly logger: Logger,
  ) {}

  async createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle> {
    try {
      const response = await withRetry(
        'createPending',
        () =>
          this.service.createActivityLog({
            forestServerToken: args.forestServerToken,
            renderingId: String(args.renderingId),
            action: args.action as ActivityLogAction,
            type: args.type,
            collectionName: args.collectionName,
            recordId: args.recordId,
            label: args.label,
          }),
        this.logger,
      );

      return { id: response.id, index: response.attributes.index };
    } catch (cause) {
      throw new ActivityLogCreationError(cause);
    }
  }

  async markSucceeded(handle: ActivityLogHandle, forestServerToken: string): Promise<void> {
    try {
      await withRetry(
        'markSucceeded',
        () =>
          this.service.updateActivityLogStatus({
            forestServerToken,
            activityLog: { id: handle.id, attributes: { index: handle.index } },
            status: 'completed',
          }),
        this.logger,
      );
    } catch (err) {
      this.logger.error('Activity log markSucceeded failed after retries', {
        handleId: handle.id,
        error: extractErrorMessage(err),
      });
    }
  }

  async markFailed(
    handle: ActivityLogHandle,
    forestServerToken: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await withRetry(
        'markFailed',
        () =>
          this.service.updateActivityLogStatus({
            forestServerToken,
            activityLog: { id: handle.id, attributes: { index: handle.index } },
            status: 'failed',
            errorMessage,
          }),
        this.logger,
      );
    } catch (err) {
      this.logger.error('Activity log markFailed failed after retries', {
        handleId: handle.id,
        error: extractErrorMessage(err),
      });
    }
  }
}
