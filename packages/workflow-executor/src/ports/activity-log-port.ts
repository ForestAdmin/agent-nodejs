export interface CreateActivityLogArgs {
  forestServerToken: string;
  renderingId: number;
  /** Action identifier understood by Forest Admin backend. */
  action: string;
  type: 'read' | 'write';
  collectionName?: string;
  recordId?: string | number;
  label?: string;
}

/**
 * Opaque handle returned by `createPending`; caller passes it back to
 * `markSucceeded` / `markFailed` to transition the log status.
 */
export interface ActivityLogHandle {
  id: string;
  index: string;
}

/**
 * Port for emitting Forest Admin activity logs around each workflow step
 * whose action is executed by the executor itself.
 *
 * Lifecycle:
 *   1. `createPending` creates a Pending log; throws ActivityLogCreationError
 *      if creation ultimately fails. Step must then fail in error.
 *   2. `markSucceeded` / `markFailed` transitions the log once the step is done.
 *
 * The transition methods (`markSucceeded` / `markFailed`) internally retry
 * transient failures before resolving. Callers that don't want to block on
 * completion should invoke with `void` — see
 * `base-step-executor.ts::runWithActivityLog`. Such callers must call
 * `drain()` at shutdown to let the in-flight transitions settle.
 */
export interface ActivityLogPort {
  createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle, forestServerToken: string): Promise<void>;
  markFailed(
    handle: ActivityLogHandle,
    forestServerToken: string,
    errorMessage: string,
  ): Promise<void>;
  /**
   * Resolve once all in-flight transitions (from voided `markSucceeded` /
   * `markFailed` calls) have settled. Called by the Runner at shutdown so the
   * audit trail isn't left with Pending rows when the process exits.
   */
  drain(): Promise<void>;
}
