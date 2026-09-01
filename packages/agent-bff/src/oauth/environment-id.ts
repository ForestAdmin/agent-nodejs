import type ForestServerClient from './forest-server-client';

/** Resolves the Forest environment id, on demand rather than at boot. */
export type EnvironmentIdResolver = () => Promise<number>;

/**
 * Fetch the environment id at most once per success, and never cache a failure: a Forest server
 * that is briefly unreachable must not disable the routes that need the id for the life of the
 * process, which is what resolving it at boot did. Concurrent callers share the in-flight fetch.
 */
export default function createEnvironmentIdResolver(
  client: Pick<ForestServerClient, 'fetchEnvironmentId'>,
): EnvironmentIdResolver {
  let environmentId: number | undefined;
  let inFlight: Promise<number> | null = null;

  return async function resolveEnvironmentId(): Promise<number> {
    if (environmentId !== undefined) return environmentId;

    inFlight ??= client
      .fetchEnvironmentId()
      .then(resolved => {
        environmentId = resolved;

        return resolved;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}
