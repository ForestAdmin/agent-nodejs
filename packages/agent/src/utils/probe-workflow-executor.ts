import type { Logger } from '@forestadmin/datasource-toolkit';

const TIMEOUT_MS = 5_000;

/**
 * Pings the workflow executor's public /health endpoint at agent startup.
 * Logs Info on success, Warn on failure. Never throws — the agent must keep
 * starting even if the executor is temporarily down; only workflow proxy
 * routes will be affected, the rest of the agent keeps serving normally.
 */
export default async function probeWorkflowExecutor(
  executorUrl: string,
  logger: Logger,
): Promise<void> {
  const url = `${executorUrl.replace(/\/+$/, '')}/health`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      logger(
        'Warn',
        `Workflow executor probe: ${executorUrl} responded with ${response.status} ${response.statusText}. ` +
          `Workflow routes may return errors until the executor is healthy.`,
      );

      return;
    }

    logger('Info', `Workflow executor is reachable at ${executorUrl}`);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    let reason: string;
    if (isTimeout) reason = `timeout after ${TIMEOUT_MS}ms`;
    else if (error instanceof Error) reason = error.message;
    else reason = String(error);

    logger(
      'Warn',
      `Workflow executor probe: cannot reach ${executorUrl} (${reason}). ` +
        `Workflow routes will be unavailable until the executor starts.`,
    );
  }
}
