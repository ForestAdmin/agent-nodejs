/** Rate limiting is the one 4xx that heals on its own. */
const RETRYABLE_CLIENT_STATUS = 429;

function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== RETRYABLE_CLIENT_STATUS;
}

/**
 * A failed environment id read, told apart by whether retrying can ever help: a Forest server that
 * answers and refuses is a configuration error that will never resolve, anything else is transport.
 * Consumers log the first at `Error` and the second at `Warn`, which is the only thing that lets an
 * operator distinguish a wrong FOREST_ENV_SECRET from a SaaS blip.
 */
export default class EnvironmentFetchError extends Error {
  readonly permanent: boolean;

  static fromStatus(status: number, statusText: string): EnvironmentFetchError {
    return new EnvironmentFetchError(
      `Failed to fetch environment: ${status} ${statusText}`,
      isPermanentStatus(status),
    );
  }

  constructor(message: string, permanent: boolean) {
    super(message);
    this.name = 'EnvironmentFetchError';
    this.permanent = permanent;
  }
}

/** Anything that is not a refusal from the Forest server — a socket error, a timeout — may heal. */
export function isPermanentEnvironmentFailure(error: unknown): boolean {
  return error instanceof EnvironmentFetchError && error.permanent;
}

export function environmentFailureLevel(error: unknown): 'Error' | 'Warn' {
  return isPermanentEnvironmentFailure(error) ? 'Error' : 'Warn';
}
