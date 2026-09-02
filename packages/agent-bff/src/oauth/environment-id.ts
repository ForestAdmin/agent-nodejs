import type ForestServerClient from './forest-server-client';
import type { Logger } from '../ports/logger-port';

import { environmentFailureLevel } from './environment-fetch-error';

/** Resolves the Forest environment id, on demand rather than at boot. */
export type EnvironmentIdResolver = () => Promise<number>;

/**
 * How long a failure is remembered. Short enough that a transient outage still heals on the next
 * request — the whole point of resolving lazily — long enough that a burst of requests costs the
 * Forest server one round trip instead of one each, and costs the caller one deadline instead of
 * one per request.
 */
const FAILURE_TTL_MS = 5_000;

/**
 * Fetch the environment id at most once per success, and hold a failure only for `FAILURE_TTL_MS`:
 * a Forest server that is briefly unreachable must not disable the routes that need the id for the
 * life of the process, which is what resolving it at boot did. Concurrent callers share the
 * in-flight fetch.
 *
 * The three consumers deliberately disagree on what a failure means, because the id is worth a
 * different amount to each: `/oauth/authorize` cannot mint a login without it and surfaces
 * `server_error`, the AI relay cannot address the proxy without it and refuses the query, and
 * `/agent/v1/context` merely decorates its payload with it and drops the field (see
 * `tolerateEnvironmentIdFailure`).
 */
export default function createEnvironmentIdResolver(
  client: Pick<ForestServerClient, 'fetchEnvironmentId'>,
  now: () => number = Date.now,
): EnvironmentIdResolver {
  let environmentId: number | undefined;
  let inFlight: Promise<number> | null = null;
  let failedAt: number | undefined;
  let failure: unknown;

  return async function resolveEnvironmentId(): Promise<number> {
    if (environmentId !== undefined) return environmentId;
    if (failedAt !== undefined && now() - failedAt < FAILURE_TTL_MS) throw failure;

    inFlight ??= client
      .fetchEnvironmentId()
      .then(resolved => {
        environmentId = resolved;
        failedAt = undefined;

        return resolved;
      })
      .catch(error => {
        failedAt = now();
        failure = error;

        throw error;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}

/**
 * The context payload carries the environment id when there is one, and drops it when the Forest
 * server cannot be reached — the route itself must keep answering either way. A refusal from the
 * Forest server is logged at `Error` because it will never resolve on its own; a transport failure
 * stays a `Warn`.
 */
export function tolerateEnvironmentIdFailure(
  resolveEnvironmentId: EnvironmentIdResolver,
  logger: Logger,
): () => Promise<number | undefined> {
  return async function resolveOrForget(): Promise<number | undefined> {
    try {
      return await resolveEnvironmentId();
    } catch (error) {
      logger(environmentFailureLevel(error), 'Serving the context without an environment id', {
        cause: error instanceof Error ? error.message : String(error),
      });

      return undefined;
    }
  };
}
